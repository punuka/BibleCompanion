import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { DEFAULT_LANGUAGE, isSupportedLanguage, type Citation } from '@bible/shared';
import { prisma } from '../lib/prisma.js';
import { parseList, stringify } from '../lib/json.js';
import { streamChatTurn, titleConversation, type ChatMessage } from '../services/ai/index.js';
import { screen } from '../services/safety.js';

const createSchema = z.object({
  language: z.string().optional(),
  title: z.string().max(80).optional(),
});

const messageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(8000),
});

/** History window. Older turns drop off rather than growing the prompt without bound. */
const HISTORY_TURNS = 24;

function sse(reply: FastifyReply, event: string, data: unknown): void {
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export default async function chatRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/chat/conversations', async (req) => {
    const rows = await prisma.conversation.findMany({
      where: { userId: req.user.sub },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
    return rows.map((c) => ({
      id: c.id,
      title: c.title,
      language: c.language,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      messageCount: c._count.messages,
    }));
  });

  app.post('/chat/conversations', async (req, reply) => {
    const body = createSchema.parse(req.body ?? {});
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.sub } });
    const language =
      body.language && isSupportedLanguage(body.language) ? body.language : user.language;

    // Reuse an empty conversation rather than piling up untouched
    // "New conversation" threads every time the user taps the button.
    const empty = await prisma.conversation.findFirst({
      where: { userId: user.id, messages: { none: {} } },
      orderBy: { updatedAt: 'desc' },
    });

    const conversation = empty
      ? await prisma.conversation.update({
          where: { id: empty.id },
          data: { language, title: body.title ?? empty.title },
        })
      : await prisma.conversation.create({
          data: { userId: user.id, language, title: body.title ?? 'New conversation' },
        });

    return reply.code(empty ? 200 : 201).send({
      id: conversation.id,
      title: conversation.title,
      language: conversation.language,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messages: [],
    });
  });

  app.get<{ Params: { id: string } }>('/chat/conversations/:id', async (req, reply) => {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.user.sub },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) {
      return reply.code(404).send({ error: 'Not Found', message: 'Conversation not found.', statusCode: 404 });
    }
    return reply.send({
      id: conversation.id,
      title: conversation.title,
      language: conversation.language,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        citations: parseList<Citation>(m.citations),
        createdAt: m.createdAt.toISOString(),
      })),
    });
  });

  app.delete<{ Params: { id: string } }>('/chat/conversations/:id', async (req, reply) => {
    const { count } = await prisma.conversation.deleteMany({
      where: { id: req.params.id, userId: req.user.sub },
    });
    if (count === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Conversation not found.', statusCode: 404 });
    }
    return reply.code(204).send();
  });

  /**
   * Streams the assistant turn as SSE. Event contract is documented in
   * .claude/skills/bible-companion/references/architecture.md.
   */
  app.post<{ Params: { id: string } }>('/chat/conversations/:id/messages', async (req, reply) => {
    const body = messageSchema.parse(req.body);

    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.user.sub },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: HISTORY_TURNS } },
    });
    if (!conversation) {
      return reply.code(404).send({ error: 'Not Found', message: 'Conversation not found.', statusCode: 404 });
    }

    const language = isSupportedLanguage(conversation.language)
      ? conversation.language
      : DEFAULT_LANGUAGE;

    // Screen BEFORE the model sees anything.
    const safety = screen(body.content, language);

    const userMessage = await prisma.message.create({
      data: { conversationId: conversation.id, role: 'user', content: body.content },
    });

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    sse(reply, 'meta', { messageId: userMessage.id, language });
    if (safety) sse(reply, 'safety', safety);

    const history: ChatMessage[] = conversation.messages
      .slice()
      .reverse()
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    history.push({ role: 'user', content: body.content });

    try {
      const result = await streamChatTurn(
        { history, language, crisis: safety?.level === 'crisis' },
        {
          onDelta: (text) => sse(reply, 'delta', { text }),
          onCitation: (citation) => sse(reply, 'citation', citation),
        },
      );

      const assistantMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: result.text,
          citations: stringify(result.citations),
        },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      sse(reply, 'done', { messageId: assistantMessage.id, citations: result.citations });
    } catch (err) {
      req.log.error({ err }, 'chat stream failed');
      sse(reply, 'error', {
        message: err instanceof Error ? err.message : 'The reply could not be generated.',
      });
    } finally {
      reply.raw.end();
    }

    // Name the thread after the first exchange. Deliberately not awaited into
    // the response — a slow or failed title must not delay the reply.
    if (conversation.title === 'New conversation') {
      void titleConversation(body.content, language)
        .then((title) =>
          prisma.conversation.update({ where: { id: conversation.id }, data: { title } }),
        )
        .catch((err: unknown) => req.log.warn({ err }, 'conversation titling failed'));
    }
  });
}
