import type { Content, Part } from '@google/genai';
import type { Citation } from '@bible/shared';
import { genai, CHAT_MODEL, UTILITY_MODEL } from './client.js';
import { buildChatSystemPrompt, CRISIS_ADDENDUM, TITLE_PROMPT } from './prompts.js';
import { BIBLE_TOOLS, executeBibleTool } from './tools.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamHandlers {
  onDelta: (text: string) => void;
  onCitation: (citation: Citation) => void;
}

export interface ChatTurnInput {
  history: ChatMessage[];
  language: string;
  crisis: boolean;
}

export interface ChatTurnResult {
  text: string;
  citations: Citation[];
}

const MAX_TOOL_ITERATIONS = 5;

/**
 * One assistant turn, streamed.
 *
 * This is a manual streaming loop rather than a helper like `Chat.sendMessageStream`,
 * because the HTTP client needs per-token deltas relayed to SSE while the
 * scripture tools still execute server-side.
 */
export async function streamChatTurn(
  input: ChatTurnInput,
  handlers: StreamHandlers,
): Promise<ChatTurnResult> {
  const contents: Content[] = input.history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const citations: Citation[] = [];
  const seenRefs = new Set<string>();
  let finalText = '';

  let systemInstruction = buildChatSystemPrompt(input.language);
  if (input.crisis) {
    systemInstruction += CRISIS_ADDENDUM;
  }

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const stream = await genai.models.generateContentStream({
      model: CHAT_MODEL,
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: BIBLE_TOOLS }],
      },
    });

    let turnText = '';
    const calls: { id?: string; name: string; args: Record<string, unknown> }[] = [];
    // Newer Gemini models attach a thought_signature to the functionCall part
    // itself and require it echoed back verbatim on the next turn, so parts
    // are read straight off the chunk rather than rebuilt from chunk.functionCalls
    // (which discards that field).
    const modelParts: Part[] = [];

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        turnText += text;
        finalText += text;
        handlers.onDelta(text);
      }
      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        if (part.functionCall?.name) {
          calls.push({
            id: part.functionCall.id,
            name: part.functionCall.name,
            args: (part.functionCall.args ?? {}) as Record<string, unknown>,
          });
          modelParts.push(part);
        }
      }
    }

    if (calls.length === 0) {
      return { text: finalText, citations };
    }

    if (turnText) modelParts.unshift({ text: turnText });
    contents.push({ role: 'model', parts: modelParts });

    const responseParts: Part[] = [];
    for (const call of calls) {
      const outcome = await executeBibleTool(call.name, call.args, input.language);
      for (const citation of outcome.citations) {
        if (seenRefs.has(citation.ref)) continue;
        seenRefs.add(citation.ref);
        citations.push(citation);
        handlers.onCitation(citation);
      }
      responseParts.push({
        functionResponse: { id: call.id, name: call.name, response: outcome.response },
      });
    }

    // All results for a parallel batch go back in one turn. Splitting them
    // across turns teaches the model to stop calling tools in parallel.
    contents.push({ role: 'user', parts: responseParts });
  }

  return { text: finalText, citations };
}

/**
 * Names a thread from its first exchange. Cheap model, tiny output — this never
 * produces pastoral content, so the quality bar is "recognisable in a list".
 */
export async function titleConversation(
  firstUserMessage: string,
  language: string,
): Promise<string> {
  try {
    const response = await genai.models.generateContent({
      model: UTILITY_MODEL,
      contents: [{ role: 'user', parts: [{ text: firstUserMessage.slice(0, 1000) }] }],
      config: {
        systemInstruction: TITLE_PROMPT,
        maxOutputTokens: 32,
      },
    });
    const title = (response.text ?? '').trim().replace(/^["']|["']$/g, '');
    return title.slice(0, 80) || fallbackTitle(firstUserMessage);
  } catch {
    // A failed title must never fail the message the user actually sent.
    void language;
    return fallbackTitle(firstUserMessage);
  }
}

function fallbackTitle(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed.length > 48 ? `${trimmed.slice(0, 45)}…` : trimmed || 'New conversation';
}
