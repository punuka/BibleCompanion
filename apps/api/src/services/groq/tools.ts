import type { ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * Same tools as ../gemini/tools.ts, same descriptions, just in OpenAI's
 * function-calling schema shape instead of Gemini's. Tool *execution*
 * (executeBibleTool) is provider-agnostic and lives there — re-exported
 * below rather than duplicated.
 */
export const BIBLE_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'bible_lookup',
      description:
        'Retrieve the exact text of a specific Bible passage by reference. Use this whenever you intend to quote a passage you already have in mind, so the wording is verbatim rather than remembered. Accepts a single verse ("John 14:27") or a short range ("Psalm 23:1-4"). Returns an empty list if the passage is not in the store — in that case tell the person you could not find it; do not supply the text yourself.',
      parameters: {
        type: 'object',
        properties: {
          ref: {
            type: 'string',
            description: 'Book chapter:verse, optionally a range. Example: "Romans 8:38-39".',
          },
        },
        required: ['ref'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bible_search',
      description:
        "Find passages by wording or by theme when you do not have a specific reference in mind. Use this before offering consolation so the verse fits the person's actual situation rather than being the familiar default. Combine `query` (words appearing in the verse) and `theme` for a narrower result.",
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Words or a phrase expected in the verse text.',
          },
          theme: {
            type: 'string',
            description:
              'A theme tag. One of: comfort, mourning, hope, peace, trust, fear, presence, belonging, healing, endurance, provision, work, love, forgiveness, patience, grace, mercy, faith, seeking, guidance, calling, wisdom, thanksgiving, joy, praise, strength.',
          },
          limit: {
            // Llama models on Groq sometimes emit this as a numeric string
            // ("6") rather than a bare integer; Groq validates tool-call
            // arguments against this schema server-side and rejects the
            // call outright if it's typed as integer-only, so both forms
            // are accepted here and coerced in executeBibleTool.
            type: ['integer', 'string'],
            description: 'Maximum results, 1–25. Defaults to 6.',
          },
        },
      },
    },
  },
];

export { executeBibleTool, type ToolOutcome } from '../gemini/tools.js';
