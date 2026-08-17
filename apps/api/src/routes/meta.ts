import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { LANGUAGES, SITUATIONS, SPECIALTIES } from '@bible/shared';

/**
 * Public, unauthenticated metadata. Deliberately reachable without a token —
 * the sign-up screen needs the language list before an account exists, and
 * /health is the first thing to curl when the app cannot reach the API.
 */
export default async function metaRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({
    ok: true,
    service: 'bible-companion-api',
    time: new Date().toISOString(),
  }));

  app.get('/languages', async () => LANGUAGES);

  app.get('/situations', async () => SITUATIONS);

  app.get('/specialties', async () => SPECIALTIES);

  // Temporary diagnostic sink for the mobile app's startup crash reporter
  // (apps/mobile/index.js). No auth — a crash can happen before login ever
  // succeeds. Remove once the client is stable.
  app.post('/debug/client-error', async (req) => {
    const body = z
      .object({
        label: z.string(),
        message: z.string(),
        stack: z.string().optional(),
        isFatal: z.boolean().optional(),
      })
      .parse(req.body);
    req.log.error({ client: body }, 'mobile client reported a startup error');
    return { ok: true };
  });
}
