/**
 * Provider-agnostic facade over the model calls chat.ts and comfort.ts
 * routes actually use. Gemini is primary; Groq (optional — only wired if
 * GROQ_API_KEY is set) is a fallback for when Gemini errors out, not a
 * replacement. Routes should import from here, not from ../gemini/* or
 * ../groq/* directly, so the fallback stays in one place.
 */
import { env } from '../../env.js';
import * as gemini from '../gemini/chat.js';
import * as geminiComfort from '../gemini/comfort.js';
import * as groqChat from '../groq/chat.js';
import * as groqComfort from '../groq/comfort.js';
import type { ChatTurnInput, ChatTurnResult, StreamHandlers } from '../gemini/chat.js';
import type { ComfortResult } from '../gemini/comfort.js';

export type { ChatMessage } from '../gemini/chat.js';
export type { ComfortResult } from '../gemini/comfort.js';

const hasFallback = !!env.GROQ_API_KEY;

/**
 * Falls back to Groq only if Gemini fails before any content was streamed
 * to the client — once a reply is partway out over SSE, restarting it on a
 * different provider would just duplicate or garble what the user already
 * sees, so a failure past that point is left to surface as-is.
 */
export async function streamChatTurn(
  input: ChatTurnInput,
  handlers: StreamHandlers,
): Promise<ChatTurnResult> {
  let deltaEmitted = false;
  const trackingHandlers: StreamHandlers = {
    onDelta: (text) => {
      deltaEmitted = true;
      handlers.onDelta(text);
    },
    onCitation: handlers.onCitation,
  };

  try {
    return await gemini.streamChatTurn(input, trackingHandlers);
  } catch (err) {
    if (deltaEmitted || !hasFallback) throw err;
    console.warn(
      `[ai] Gemini chat failed before any output, falling back to Groq: ${err instanceof Error ? err.message : String(err)}`,
    );
    const result = await groqChat.streamChatTurn(input, handlers);
    console.warn('[ai] Groq fallback succeeded for chat');
    return result;
  }
}

export async function composeComfort(opts: {
  situationId: string | null;
  freeText: string;
  language: string;
}): Promise<ComfortResult> {
  try {
    return await geminiComfort.composeComfort(opts);
  } catch (err) {
    if (!hasFallback) throw err;
    console.warn(
      `[ai] Gemini comfort failed, falling back to Groq: ${err instanceof Error ? err.message : String(err)}`,
    );
    const result = await groqComfort.composeComfort(opts);
    console.warn('[ai] Groq fallback succeeded for comfort');
    return result;
  }
}

export async function titleConversation(firstUserMessage: string, language: string): Promise<string> {
  return gemini.titleConversation(firstUserMessage, language);
}
