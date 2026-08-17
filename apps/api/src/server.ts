import { buildApp } from './app.js';
import { env } from './env.js';
import { prisma } from './lib/prisma.js';

const app = await buildApp();

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(
    `Bible Companion API listening on http://${env.HOST}:${env.PORT} — health: /v1/health`,
  );
  if (env.HOST === '127.0.0.1' || env.HOST === 'localhost') {
    app.log.warn(
      'HOST is loopback-only. Emulators and physical devices will not be able to reach this API. Set HOST=0.0.0.0.',
    );
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void (async () => {
      app.log.info(`${signal} received, shutting down`);
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    })();
  });
}
