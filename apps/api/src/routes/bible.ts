import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DEFAULT_LANGUAGE, isSupportedLanguage } from '@bible/shared';
import * as bible from '../services/bible.js';
import { prisma } from '../lib/prisma.js';

const verseQuery = z.object({
  ref: z.string().min(1),
  language: z.string().optional(),
});

const searchQuery = z.object({
  q: z.string().optional(),
  theme: z.string().optional(),
  language: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(25).optional(),
});

export default async function bibleRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  async function resolveLanguage(userId: string, requested?: string): Promise<string> {
    if (requested && isSupportedLanguage(requested)) return requested;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return user && isSupportedLanguage(user.language) ? user.language : DEFAULT_LANGUAGE;
  }

  app.get('/bible/verse', async (req, reply) => {
    const query = verseQuery.parse(req.query);
    const language = await resolveLanguage(req.user.sub, query.language);
    const verses = await bible.lookup(query.ref, language);

    if (verses.length === 0) {
      return reply.code(404).send({
        error: 'Not Found',
        message: `No passage matching "${query.ref}" is available.`,
        statusCode: 404,
      });
    }
    return reply.send({ ref: query.ref, verses });
  });

  app.get('/bible/search', async (req, reply) => {
    const query = searchQuery.parse(req.query);
    if (!query.q && !query.theme) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Provide at least one of `q` or `theme`.',
        statusCode: 400,
      });
    }
    const language = await resolveLanguage(req.user.sub, query.language);
    const verses = await bible.search({
      query: query.q,
      theme: query.theme,
      limit: query.limit,
      language,
    });
    return reply.send({ count: verses.length, verses });
  });
}
