import OpenAI from 'openai';
import { env } from '../../env.js';

/**
 * Groq's API is OpenAI-compatible, so the `openai` SDK works unmodified
 * against it — just a different base URL and key. This is the fallback
 * provider (see ../ai/index.ts); Gemini remains primary.
 */
export const groq = env.GROQ_API_KEY
  ? new OpenAI({ apiKey: env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
  : null;

/**
 * openai/gpt-oss-120b, not a Llama model. Llama's tool calling on Groq is
 * prompt-emulated (Groq parses special tokens out of free text) and proved
 * unreliable in practice — it produced malformed function-call syntax on a
 * second, retried tool call in the same turn. gpt-oss is trained on the
 * standard OpenAI tool-calling protocol this SDK actually speaks, and held
 * up where Llama didn't.
 */
export const CHAT_MODEL = 'openai/gpt-oss-120b';

/** Fast, small model for the throwaway thread-title pass only. */
export const UTILITY_MODEL = 'llama-3.1-8b-instant';
