import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  DEFAULT_LANGUAGE,
  SITUATION_IDS,
  isSupportedLanguage,
  type Citation,
  type ComfortResponse,
  type SafetyNotice,
} from '@bible/shared';
import { prisma } from '../lib/prisma.js';
import { parseList, parseObject, stringify } from '../lib/json.js';
import { composeComfort } from '../services/ai/index.js';
import { screen } from '../services/safety.js';

const requestSchema = z.object({
  situation: z.enum(SITUATION_IDS as [string, ...string[]]).nullable().optional(),
  freeText: z.string().min(1, 'Describe what you are going through').max(4000),
  language: z.string().optional(),
});

type Row = {
  id: string;
  situation: string | null;
  acknowledgement: string;
  reflection: string;
  prayer: string;
  verses: string;
  followUp: string;
  safety: string | null;
  createdAt: Date;
};

function toResponse(row: Row): ComfortResponse {
  return {
    id: row.id,
    situation: row.situation,
    acknowledgement: row.acknowledgement,
    verses: parseList<Citation>(row.verses),
    reflection: row.reflection,
    prayer: row.prayer,
    followUp: parseList<string>(row.followUp),
    safety: parseObject<SafetyNotice>(row.safety),
    createdAt: row.createdAt.toISOString(),
  };
}

export default async function comfortRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.post('/comfort', async (req, reply) => {
    const body = requestSchema.parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.sub } });
    const language =
      body.language && isSupportedLanguage(body.language)
        ? body.language
        : isSupportedLanguage(user.language)
          ? user.language
          : DEFAULT_LANGUAGE;

    // Screen first — the resources go out regardless of whether the model call
    // succeeds, so a model failure can never swallow a crisis signal.
    const safety = screen(body.freeText, language);

    let result;
    try {
      result = await composeComfort({
        situationId: body.situation ?? null,
        freeText: body.freeText,
        language,
      });
    } catch (err) {
      req.log.error({ err }, 'comfort composition failed');
      if (safety) {
        // Degrade to resources only rather than failing outright.
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'A response could not be generated right now.',
          statusCode: 503,
          safety,
        });
      }
      return reply.code(503).send({
        error: 'Service Unavailable',
        message: 'A response could not be generated right now. Please try again.',
        statusCode: 503,
      });
    }

    if (result.droppedRefs.length > 0) {
      // A dropped ref means the model produced a citation the store cannot
      // confirm. Worth investigating as a prompt-quality signal.
      req.log.warn({ droppedRefs: result.droppedRefs, language }, 'unverified verse refs dropped');
    }

    const session = await prisma.comfortSession.create({
      data: {
        userId: user.id,
        situation: body.situation ?? null,
        input: body.freeText,
        acknowledgement: result.acknowledgement,
        reflection: result.reflection,
        prayer: result.prayer,
        verses: stringify(result.verses),
        followUp: stringify(result.followUp),
        safety: safety ? stringify(safety) : null,
      },
    });

    return reply.code(201).send(toResponse(session));
  });

  app.get('/comfort', async (req) => {
    const rows = await prisma.comfortSession.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map(toResponse);
  });

  app.get<{ Params: { id: string } }>('/comfort/:id', async (req, reply) => {
    const row = await prisma.comfortSession.findFirst({
      where: { id: req.params.id, userId: req.user.sub },
    });
    if (!row) {
      return reply.code(404).send({ error: 'Not Found', message: 'Reflection not found.', statusCode: 404 });
    }
    return reply.send(toResponse(row));
  });
}
