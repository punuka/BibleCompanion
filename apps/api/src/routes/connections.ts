import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Connection } from '@bible/shared';
import { prisma } from '../lib/prisma.js';

const decisionSchema = z.object({
  status: z.enum(['ACCEPTED', 'DECLINED', 'CLOSED']),
});

const messageSchema = z.object({
  body: z.string().min(1).max(4000).trim(),
});

type ConnectionRow = {
  id: string;
  status: string;
  topic: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  counselorProfileId: string;
  user: { id: string; displayName: string };
  counselor: { id: string; headline: string; userId: string; user: { displayName: string } };
  messages: { createdAt: Date }[];
};

function toConnection(row: ConnectionRow): Connection {
  return {
    id: row.id,
    status: row.status as Connection['status'],
    topic: row.topic,
    language: row.language,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    counselor: {
      id: row.counselor.id,
      displayName: row.counselor.user.displayName,
      headline: row.counselor.headline,
    },
    user: { id: row.user.id, displayName: row.user.displayName },
    lastMessageAt: row.messages[0]?.createdAt.toISOString() ?? null,
  };
}

const INCLUDE = {
  user: { select: { id: true, displayName: true } },
  counselor: { select: { id: true, headline: true, userId: true, user: { select: { displayName: true } } } },
  messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
} as const;

export default async function connectionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  /**
   * Both checks, every time: the caller must be one of the two parties, and
   * (for messaging) the connection must be ACCEPTED. A REQUESTED connection is
   * not yet a channel.
   */
  async function loadAuthorized(connectionId: string, userId: string) {
    const row = await prisma.connection.findUnique({
      where: { id: connectionId },
      include: INCLUDE,
    });
    if (!row) return { row: null, isUser: false, isCounselor: false };
    return {
      row,
      isUser: row.userId === userId,
      isCounselor: row.counselor.userId === userId,
    };
  }

  /** Everything the caller is a party to, in either role. */
  app.get('/connections', async (req) => {
    const rows = await prisma.connection.findMany({
      where: {
        OR: [{ userId: req.user.sub }, { counselor: { userId: req.user.sub } }],
      },
      include: INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => ({
      ...toConnection(r),
      role: r.userId === req.user.sub ? 'seeker' : 'counselor',
    }));
  });

  app.get<{ Params: { id: string } }>('/connections/:id', async (req, reply) => {
    const { row, isUser, isCounselor } = await loadAuthorized(req.params.id, req.user.sub);
    if (!row || (!isUser && !isCounselor)) {
      return reply.code(404).send({ error: 'Not Found', message: 'Connection not found.', statusCode: 404 });
    }
    return reply.send(toConnection(row));
  });

  /** Accept or decline (counsellor), or close (either party). */
  app.patch<{ Params: { id: string } }>('/connections/:id', async (req, reply) => {
    const body = decisionSchema.parse(req.body);
    const { row, isUser, isCounselor } = await loadAuthorized(req.params.id, req.user.sub);

    if (!row || (!isUser && !isCounselor)) {
      return reply.code(404).send({ error: 'Not Found', message: 'Connection not found.', statusCode: 404 });
    }

    if ((body.status === 'ACCEPTED' || body.status === 'DECLINED') && !isCounselor) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Only the counsellor can accept or decline a request.',
        statusCode: 403,
      });
    }

    if (body.status !== 'CLOSED' && row.status !== 'REQUESTED') {
      return reply.code(409).send({
        error: 'Conflict',
        message: `This connection is already ${row.status.toLowerCase()}.`,
        statusCode: 409,
      });
    }

    const updated = await prisma.connection.update({
      where: { id: req.params.id },
      data: { status: body.status },
      include: INCLUDE,
    });
    return reply.send(toConnection(updated));
  });

  app.get<{ Params: { id: string } }>('/connections/:id/messages', async (req, reply) => {
    const { row, isUser, isCounselor } = await loadAuthorized(req.params.id, req.user.sub);
    if (!row || (!isUser && !isCounselor)) {
      return reply.code(404).send({ error: 'Not Found', message: 'Connection not found.', statusCode: 404 });
    }

    const messages = await prisma.connectionMessage.findMany({
      where: { connectionId: req.params.id },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { displayName: true } } },
    });

    return reply.send(
      messages.map((m) => ({
        id: m.id,
        connectionId: m.connectionId,
        senderId: m.senderId,
        senderName: m.sender.displayName,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
    );
  });

  /**
   * Plain human-to-human text. No model, no scripture tools, no streaming —
   * the value of this feature is precisely that it is not the AI.
   */
  app.post<{ Params: { id: string } }>('/connections/:id/messages', async (req, reply) => {
    const body = messageSchema.parse(req.body);
    const { row, isUser, isCounselor } = await loadAuthorized(req.params.id, req.user.sub);

    if (!row || (!isUser && !isCounselor)) {
      return reply.code(404).send({ error: 'Not Found', message: 'Connection not found.', statusCode: 404 });
    }
    if (row.status !== 'ACCEPTED') {
      return reply.code(409).send({
        error: 'Conflict',
        message: 'Messages can only be sent on an accepted connection.',
        statusCode: 409,
      });
    }

    const message = await prisma.connectionMessage.create({
      data: { connectionId: req.params.id, senderId: req.user.sub, body: body.body },
      include: { sender: { select: { displayName: true } } },
    });

    await prisma.connection.update({
      where: { id: req.params.id },
      data: { updatedAt: new Date() },
    });

    return reply.code(201).send({
      id: message.id,
      connectionId: message.connectionId,
      senderId: message.senderId,
      senderName: message.sender.displayName,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    });
  });
}
