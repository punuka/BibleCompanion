import 'dotenv/config';
import { z } from 'zod';

/**
 * Fail fast and loudly on misconfiguration. A missing GEMINI_API_KEY that
 * only surfaces on the first chat message is far worse than a startup crash.
 */
const schema = z.object({
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required — see .env.example'),
  // Optional fallback provider (see services/ai/index.ts) for when Gemini
  // errors out — quota, an overloaded model, a transient outage. Chat/comfort
  // work fine without it; they just don't have a fallback to fall back to.
  GROQ_API_KEY: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(8787),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGINS: z.string().default('http://localhost:8081,http://localhost:19006'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`\nInvalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
