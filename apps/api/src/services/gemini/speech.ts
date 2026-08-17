import { genai, CHAT_MODEL } from './client.js';
import { buildTranscribePrompt } from './prompts.js';

/**
 * Transcribes a short voice note. Verified against the live API that Gemini's
 * audio pipeline sniffs the container regardless of the declared mimeType, so
 * an m4a/AAC recording from expo-av (labelled "audio/aac", one of Gemini's
 * documented supported audio types) decodes correctly.
 */
export async function transcribeAudio(opts: {
  audioBase64: string;
  mimeType: string;
  language: string;
}): Promise<string> {
  const response = await genai.models.generateContent({
    model: CHAT_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: buildTranscribePrompt(opts.language) },
          { inlineData: { mimeType: opts.mimeType, data: opts.audioBase64 } },
        ],
      },
    ],
  });

  return (response.text ?? '').trim();
}
