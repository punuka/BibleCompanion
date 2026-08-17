import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { env } from './env.js';
import authPlugin from './plugins/auth.js';
import metaRoutes from './routes/meta.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import comfortRoutes from './routes/comfort.js';
import speechRoutes from './routes/speech.js';
import bibleRoutes from './routes/bible.js';
import counselorRoutes from './routes/counselors.js';
import connectionRoutes from './routes/connections.js';
import adminRoutes from './routes/admin.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? { level: 'info', transport: undefined }
        : { level: 'warn' },
    // Mobile clients on flaky networks; give a request room before cutting it.
    connectionTimeout: 0,
    requestTimeout: 0,
  });

  await app.register(sensible);

  await app.register(cors, {
    origin: (origin, cb) => {
      // Native apps send no Origin header. Only browsers are gated here.
      if (!origin) return cb(null, true);
      cb(null, env.corsOrigins.includes(origin));
    },
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    // Model-backed routes are the expensive ones; they get their own tighter
    // limits registered alongside their plugins if traffic warrants it.
  });

  await app.register(authPlugin);

  app.setErrorHandler((error: unknown, req, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '),
        statusCode: 400,
      });
    }
    const err = error as { statusCode?: number; name?: string; message?: string };
    const status = err.statusCode ?? 500;
    if (status >= 500) req.log.error({ err: error }, 'unhandled error');
    return reply.code(status).send({
      error: status >= 500 ? 'Internal Server Error' : (err.name ?? 'Error'),
      // Never surface an internal error message to a client — it can leak
      // query shapes, file paths, and provider details.
      message: status >= 500 ? 'Something went wrong on our end.' : (err.message ?? 'Request failed.'),
      statusCode: status,
    });
  });

  await app.register(
    async (v1) => {
      await v1.register(metaRoutes);
      await v1.register(authRoutes);
      await v1.register(chatRoutes);
      await v1.register(comfortRoutes);
      await v1.register(speechRoutes);
      await v1.register(bibleRoutes);
      await v1.register(counselorRoutes);
      await v1.register(connectionRoutes);
      await v1.register(adminRoutes);
    },
    { prefix: '/v1' },
  );

  return app;
}
