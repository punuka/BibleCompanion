import { z } from 'zod';
import { APIError } from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { Citation } from '@bible/shared';
import { SITUATIONS } from '@bible/shared';
import { groq, CHAT_MODEL } from './client.js';
import { buildComfortSystemPrompt } from '../gemini/prompts.js';
import { BIBLE_TOOLS, executeBibleTool } from './tools.js';
import * as bible from '../bible.js';
import type { ComfortResult } from '../gemini/comfort.js';

const MAX_TOOL_ITERATIONS = 4;

/**
 * Groq fallback for ../gemini/comfort.ts's composeComfort. Groq's JSON mode
 * (response_format: json_object) only guarantees syntactically valid JSON,
 * not schema conformance the way Gemini's responseJsonSchema does — so the
 * shape is spelled out in the prompt and validated with zod on the way back.
 */
const responseSchema = z.object({
  acknowledgement: z.string(),
  verses: z.array(
    z.object({ ref: z.string(), text: z.string(), translation: z.string() }),
  ),
  reflection: z.string(),
  prayer: z.string(),
  followUp: z.array(z.string()),
});

const FINALIZE_INSTRUCTION = `Now compose the final comfort response, using only the passages already retrieved above.

Respond with ONLY a single JSON object — no markdown fences, no commentary before or after — with exactly these fields:
{
  "acknowledgement": "two or three sentences naming the specific thing they described",
  "verses": [{ "ref": "string", "text": "string", "translation": "string" }],
  "reflection": "a short paragraph connecting the passages to what they described",
  "prayer": "a short first-person prayer they could pray as their own words",
  "followUp": ["two or three gentle questions or invitations"]
}`;

export async function composeComfort(opts: {
  situationId: string | null;
  freeText: string;
  language: string;
}): Promise<ComfortResult> {
  if (!groq) throw new Error('GROQ_API_KEY is not configured — no fallback available.');

  const situation = SITUATIONS.find((s) => s.id === opts.situationId) ?? null;

  const seeded = situation
    ? await bible.search({ theme: situation.themes[0], language: opts.language, limit: 8 })
    : [];

  const context = [
    situation ? `Situation category: ${situation.label}` : 'No category chosen.',
    `What they wrote:\n${opts.freeText}`,
    seeded.length > 0
      ? `Passages already retrieved for this theme (you may use these directly, or search for something that fits better):\n${JSON.stringify(
          seeded.map(bible.toCitation),
        )}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const systemInstruction = buildComfortSystemPrompt(opts.language);
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemInstruction },
    { role: 'user', content: context },
  ];

  // Phase 1: tool-calling to gather scripture, same reasoning as Gemini's
  // composeComfort — Groq's models don't reliably combine tool calls with
  // JSON mode in a single request either.
  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    let response;
    try {
      response = await groq.chat.completions.create({
        model: CHAT_MODEL,
        messages,
        tools: BIBLE_TOOLS,
      });
    } catch (err) {
      // A malformed tool call from the model itself (Groq's tool_use_failed)
      // shouldn't fail the whole comfort response — this is already the
      // fallback path, there's nowhere further to fall back to. Proceed to
      // phase 2 with whatever passages were gathered so far, if any.
      if (err instanceof APIError && err.code === 'tool_use_failed') break;
      throw err;
    }

    const message = response.choices[0]?.message;
    const calls = message?.tool_calls ?? [];
    if (calls.length === 0) break;

    messages.push({
      role: 'assistant',
      content: message?.content ?? null,
      tool_calls: calls,
    });

    for (const call of calls) {
      if (call.type !== 'function') continue;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        // Malformed args — executeBibleTool's own validation reports it.
      }
      const outcome = await executeBibleTool(call.function.name, args, opts.language);
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(outcome.response),
      });
    }
  }

  // Phase 2: force the structured JSON, no tools, from the context gathered above.
  messages.push({ role: 'user', content: FINALIZE_INSTRUCTION });

  const finalResponse = await groq.chat.completions.create({
    model: CHAT_MODEL,
    messages,
    response_format: { type: 'json_object' },
  });

  const raw = finalResponse.choices[0]?.message?.content ?? '';
  if (!raw) throw new Error('No comfort response was produced.');

  const parsed = responseSchema.parse(JSON.parse(raw));

  const refs = parsed.verses.map((v) => v.ref);
  const valid = await bible.verifyRefs(refs, opts.language);
  const verses: Citation[] = parsed.verses.filter((v) => valid.has(v.ref));
  const droppedRefs = refs.filter((r) => !valid.has(r));

  return {
    acknowledgement: parsed.acknowledgement,
    verses,
    reflection: parsed.reflection,
    prayer: parsed.prayer,
    followUp: parsed.followUp.slice(0, 4),
    droppedRefs,
  };
}
