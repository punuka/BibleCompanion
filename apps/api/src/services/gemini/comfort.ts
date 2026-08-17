import type { Content, Part } from '@google/genai';
import type { Citation } from '@bible/shared';
import { SITUATIONS } from '@bible/shared';
import { genai, CHAT_MODEL } from './client.js';
import { buildComfortSystemPrompt } from './prompts.js';
import { BIBLE_TOOLS, executeBibleTool } from './tools.js';
import * as bible from '../bible.js';

export interface ComfortResult {
  acknowledgement: string;
  verses: Citation[];
  reflection: string;
  prayer: string;
  followUp: string[];
  /** Refs the model returned that did not resolve. Non-empty means a prompt problem. */
  droppedRefs: string[];
}

const SCHEMA = {
  type: 'object',
  properties: {
    acknowledgement: {
      type: 'string',
      description: 'Two or three sentences naming the specific thing they described.',
    },
    verses: {
      type: 'array',
      description: 'Two to four references obtained from a tool call in this turn.',
      items: {
        type: 'object',
        properties: {
          ref: { type: 'string' },
          text: { type: 'string' },
          translation: { type: 'string' },
        },
        required: ['ref', 'text', 'translation'],
        additionalProperties: false,
      },
    },
    reflection: { type: 'string' },
    prayer: { type: 'string' },
    followUp: {
      type: 'array',
      description: 'Two or three gentle questions or invitations.',
      items: { type: 'string' },
    },
  },
  required: ['acknowledgement', 'verses', 'reflection', 'prayer', 'followUp'],
  additionalProperties: false,
} as const;

const MAX_TOOL_ITERATIONS = 4;

const FINALIZE_INSTRUCTION =
  'Now compose the final structured comfort response as JSON matching the required schema, using only the passages already retrieved above.';

export async function composeComfort(opts: {
  situationId: string | null;
  freeText: string;
  language: string;
}): Promise<ComfortResult> {
  const situation = SITUATIONS.find((s) => s.id === opts.situationId) ?? null;

  // Pre-fetch on-theme verses so the model starts from real options rather than
  // reaching for whatever it remembers. It can still search for better ones.
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

  const contents: Content[] = [{ role: 'user', parts: [{ text: context }] }];
  const systemInstruction = buildComfortSystemPrompt(opts.language);

  // Phase 1: let the model gather scripture through tool calls. Structured
  // output and function calling are not combined in the same request — that
  // combination is unreliable across Gemini model versions — so this phase
  // runs tools-only, freeform.
  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await genai.models.generateContent({
      model: CHAT_MODEL,
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: BIBLE_TOOLS }],
      },
    });

    const calls = response.functionCalls ?? [];
    if (calls.length === 0) break;

    const modelParts: Part[] = response.candidates?.[0]?.content?.parts ?? [];
    contents.push({ role: 'model', parts: modelParts.length > 0 ? modelParts : [{ text: '' }] });

    const responseParts: Part[] = [];
    for (const call of calls) {
      if (!call.name) continue;
      const outcome = await executeBibleTool(call.name, (call.args ?? {}) as Record<string, unknown>, opts.language);
      responseParts.push({
        functionResponse: { id: call.id, name: call.name, response: outcome.response },
      });
    }
    contents.push({ role: 'user', parts: responseParts });
  }

  // Phase 2: force the structured JSON, no tools, from the context gathered above.
  contents.push({ role: 'user', parts: [{ text: FINALIZE_INSTRUCTION }] });

  const finalResponse = await genai.models.generateContent({
    model: CHAT_MODEL,
    contents,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseJsonSchema: SCHEMA,
    },
  });

  const raw = finalResponse.text ?? '';
  if (!raw) throw new Error('No comfort response was produced.');

  const parsed = JSON.parse(raw) as {
    acknowledgement: string;
    verses: Citation[];
    reflection: string;
    prayer: string;
    followUp: string[];
  };

  // Verify every reference against the store. A ref the model returned that
  // does not resolve is a fabrication and must not reach the user, even though
  // the surrounding prose is fine.
  const refs = parsed.verses.map((v) => v.ref);
  const valid = await bible.verifyRefs(refs, opts.language);
  const verses = parsed.verses.filter((v) => valid.has(v.ref));
  const droppedRefs = refs.filter((r) => !valid.has(r));

  return {
    acknowledgement: parsed.acknowledgement,
    verses,
    reflection: parsed.reflection,
    prayer: parsed.prayer,
    followUp: Array.isArray(parsed.followUp) ? parsed.followUp.slice(0, 4) : [],
    droppedRefs,
  };
}
