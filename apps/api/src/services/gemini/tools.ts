import { Type, type FunctionDeclaration } from '@google/genai';
import type { Citation } from '@bible/shared';
import * as bible from '../bible.js';

/**
 * The anti-fabrication mechanism. A model this capable "knows" the Bible, and
 * that is exactly the problem — it also confabulates references under pressure.
 * These tools are the only sanctioned source of verse text, and the system
 * prompt binds the model to them.
 */
export const BIBLE_TOOLS: FunctionDeclaration[] = [
  {
    name: 'bible_lookup',
    description:
      'Retrieve the exact text of a specific Bible passage by reference. Use this whenever you intend to quote a passage you already have in mind, so the wording is verbatim rather than remembered. Accepts a single verse ("John 14:27") or a short range ("Psalm 23:1-4"). Returns an empty list if the passage is not in the store — in that case tell the person you could not find it; do not supply the text yourself.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        ref: {
          type: Type.STRING,
          description: 'Book chapter:verse, optionally a range. Example: "Romans 8:38-39".',
        },
      },
      required: ['ref'],
    },
  },
  {
    name: 'bible_search',
    description:
      "Find passages by wording or by theme when you do not have a specific reference in mind. Use this before offering consolation so the verse fits the person's actual situation rather than being the familiar default. Combine `query` (words appearing in the verse) and `theme` for a narrower result.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Words or a phrase expected in the verse text.',
        },
        theme: {
          type: Type.STRING,
          description:
            'A theme tag. One of: comfort, mourning, hope, peace, trust, fear, presence, belonging, healing, endurance, provision, work, love, forgiveness, patience, grace, mercy, faith, seeking, guidance, calling, wisdom, thanksgiving, joy, praise, strength.',
        },
        limit: {
          type: Type.INTEGER,
          description: 'Maximum results, 1–25. Defaults to 6.',
        },
      },
    },
  },
];

export interface ToolOutcome {
  /** JSON-serializable object handed back to the model as the functionResponse. */
  response: Record<string, unknown>;
  /** Verses actually retrieved, for the citation sidebar. */
  citations: Citation[];
}

export async function executeBibleTool(
  name: string,
  args: Record<string, unknown>,
  language: string,
): Promise<ToolOutcome> {
  try {
    if (name === 'bible_lookup') {
      const ref = typeof args.ref === 'string' ? args.ref : '';
      if (!ref) {
        return { response: { error: 'ref is required' }, citations: [] };
      }
      const verses = await bible.lookup(ref, language);
      if (verses.length === 0) {
        return {
          response: {
            found: false,
            note: `No passage matching "${ref}" is in the store. Tell the person you could not find it; do not quote it from memory.`,
          },
          citations: [],
        };
      }
      return {
        response: { found: true, verses },
        citations: verses.map(bible.toCitation),
      };
    }

    if (name === 'bible_search') {
      // Some models (Llama on Groq, notably) emit limit as a numeric string
      // rather than a bare integer.
      const limit =
        typeof args.limit === 'number'
          ? args.limit
          : typeof args.limit === 'string' && args.limit.trim() !== '' && !Number.isNaN(Number(args.limit))
            ? Number(args.limit)
            : undefined;
      const verses = await bible.search({
        query: typeof args.query === 'string' ? args.query : undefined,
        theme: typeof args.theme === 'string' ? args.theme : undefined,
        limit,
        language,
      });
      return {
        response: { count: verses.length, verses },
        citations: verses.map(bible.toCitation),
      };
    }

    return { response: { error: `Unknown tool: ${name}` }, citations: [] };
  } catch (err) {
    return {
      response: { error: err instanceof Error ? err.message : 'Bible lookup failed.' },
      citations: [],
    };
  }
}
