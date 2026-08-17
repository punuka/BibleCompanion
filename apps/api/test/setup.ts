/**
 * Test environment.
 *
 * GEMINI_API_KEY is a placeholder on purpose. No test in this suite may hit
 * the live API — that would make the suite non-deterministic and bill on every
 * CI run. Model calls are mocked at the module boundary.
 */
process.env.GEMINI_API_KEY ??= 'test-placeholder-key';
process.env.JWT_SECRET ??= 'test-secret-that-is-definitely-long-enough-x';
process.env.DATABASE_URL ??= 'file:./test.db';
process.env.NODE_ENV = 'test';
