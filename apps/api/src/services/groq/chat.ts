import { APIError } from 'openai';
import type { Citation } from '@bible/shared';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { groq, CHAT_MODEL, UTILITY_MODEL } from './client.js';
import { buildChatSystemPrompt, CRISIS_ADDENDUM, TITLE_PROMPT } from '../gemini/prompts.js';
import { BIBLE_TOOLS, executeBibleTool } from './tools.js';
import type { ChatMessage, ChatTurnInput, ChatTurnResult, StreamHandlers } from '../gemini/chat.js';

const MAX_TOOL_ITERATIONS = 5;

interface PendingToolCall {
  id?: string;
  name?: string;
  arguments: string;
}

/**
 * Groq fallback for ../gemini/chat.ts's streamChatTurn — same interface,
 * same tool-calling contract, OpenAI-shaped streaming instead of Gemini's.
 * Only called when Gemini itself fails before any delta was sent (see
 * ../ai/index.ts) — a partially-streamed Gemini reply is never resumed here.
 */
export async function streamChatTurn(
  input: ChatTurnInput,
  handlers: StreamHandlers,
): Promise<ChatTurnResult> {
  if (!groq) throw new Error('GROQ_API_KEY is not configured — no fallback available.');

  let systemInstruction = buildChatSystemPrompt(input.language);
  if (input.crisis) systemInstruction += CRISIS_ADDENDUM;

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemInstruction },
    ...input.history.map(
      (m): ChatCompletionMessageParam => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }),
    ),
  ];

  const citations: Citation[] = [];
  const seenRefs = new Set<string>();
  let finalText = '';

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    let turnText = '';
    const toolCalls = new Map<number, PendingToolCall>();

    try {
      const stream = await groq.chat.completions.create({
        model: CHAT_MODEL,
        messages,
        tools: BIBLE_TOOLS,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          turnText += delta.content;
          finalText += delta.content;
          handlers.onDelta(delta.content);
        }
        for (const call of delta?.tool_calls ?? []) {
          const existing = toolCalls.get(call.index) ?? { arguments: '' };
          if (call.id) existing.id = call.id;
          if (call.function?.name) existing.name = call.function.name;
          if (call.function?.arguments) existing.arguments += call.function.arguments;
          toolCalls.set(call.index, existing);
        }
      }
    } catch (err) {
      // A malformed tool call from the model itself (Groq's tool_use_failed)
      // shouldn't fail the whole turn — this is already the fallback path,
      // there's nowhere further to fall back to. End the turn with whatever
      // text made it out before the failure, rather than an error.
      if (err instanceof APIError && err.code === 'tool_use_failed') {
        return { text: finalText, citations };
      }
      throw err;
    }

    if (toolCalls.size === 0) {
      return { text: finalText, citations };
    }

    const calls = Array.from(toolCalls.values()).filter(
      (c): c is PendingToolCall & { id: string; name: string } => !!c.id && !!c.name,
    );

    messages.push({
      role: 'assistant',
      content: turnText || null,
      tool_calls: calls.map((c) => ({
        id: c.id,
        type: 'function',
        function: { name: c.name, arguments: c.arguments },
      })),
    });

    for (const call of calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.arguments || '{}');
      } catch {
        // Malformed args from the model — proceed with an empty object;
        // executeBibleTool's own validation reports the missing fields.
      }
      const outcome = await executeBibleTool(call.name, args, input.language);
      for (const citation of outcome.citations) {
        if (seenRefs.has(citation.ref)) continue;
        seenRefs.add(citation.ref);
        citations.push(citation);
        handlers.onCitation(citation);
      }
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(outcome.response),
      });
    }
  }

  return { text: finalText, citations };
}

export async function titleConversation(firstUserMessage: string, language: string): Promise<string> {
  if (!groq) throw new Error('GROQ_API_KEY is not configured — no fallback available.');
  void language;
  const response = await groq.chat.completions.create({
    model: UTILITY_MODEL,
    messages: [
      { role: 'system', content: TITLE_PROMPT },
      { role: 'user', content: firstUserMessage.slice(0, 1000) },
    ],
    max_tokens: 32,
  });
  const title = (response.choices[0]?.message?.content ?? '').trim().replace(/^["']|["']$/g, '');
  return title.slice(0, 80);
}

export type { ChatMessage };
