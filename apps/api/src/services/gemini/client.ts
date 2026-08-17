import { GoogleGenAI } from '@google/genai';
import { env } from '../../env.js';

export const genai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

/**
 * Flash for anything the user reads as pastoral content. Pinned "-2.5-*"
 * model names are blocked for newer API keys (404 "no longer available to
 * new users"), so this tracks Google's rolling alias instead of a fixed
 * version.
 */
export const CHAT_MODEL = 'gemini-flash-latest';

/**
 * Flash-Lite for the throwaway thread-title pass only. It never produces
 * user-facing pastoral text.
 */
export const UTILITY_MODEL = 'gemini-flash-lite-latest';
