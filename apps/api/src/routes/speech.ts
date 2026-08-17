import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DEFAULT_LANGUAGE, isSupportedLanguage, type TranscribeResponse } from '@bible/shared';
import { prisma } from '../lib/prisma.js';
import { transcribeAudio } from '../services/gemini/speech.js';

const requestSchema = z.object({
  audio: z.string().min(1, 'Audio data is required'),
  mimeType: z.string().min(1).default('audio/aac'),
  language: z.string().optional(),
});

/**
 * Base64 voice notes are bigger than the default 1MB Fastify body limit — the
 * client caps recordings at ~60s, which is well under this.
 */
const AUDIO_BODY_LIMIT = 10 * 1024 * 1024;

export default async function speechRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.post<{ Body: unknown }>(
    '/speech/transcribe',
    { bodyLimit: AUDIO_BODY_LIMIT },
    async (req, reply) => {
      const body = requestSchema.parse(req.body);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.sub } });
      const language =
        body.language && isSupportedLanguage(body.language)
          ? body.language
          : isSupportedLanguage(user.language)
            ? user.language
            : DEFAULT_LANGUAGE;

      let text: string;
      try {
        text = await transcribeAudio({
          audioBase64: body.audio,
          mimeType: body.mimeType,
          language,
        });
      } catch (err) {
        req.log.error({ err }, 'transcription failed');
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'Could not transcribe that recording right now. Please try again.',
          statusCode: 503,
        });
      }

      if (!text) {
        return reply.code(422).send({
          error: 'Unprocessable Entity',
          message: 'No speech was detected in that recording.',
          statusCode: 422,
        });
      }

      return reply.send({ text } satisfies TranscribeResponse);
    },
  );
}
