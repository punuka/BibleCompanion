import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { DEFAULT_LANGUAGE, isSupportedLanguage, type PublicUser } from '@bible/shared';
import { prisma } from '../lib/prisma.js';

const registerSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1).max(60).trim(),
  language: z.string().default(DEFAULT_LANGUAGE),
});

const loginSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  password: z.string().min(1),
});

const updateSchema = z.object({
  displayName: z.string().min(1).max(60).trim().optional(),
  language: z.string().optional(),
});

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  language: string;
  createdAt: Date;
};

function toPublicUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role as PublicUser['role'],
    language: u.language,
    createdAt: u.createdAt.toISOString(),
  };
}

export default async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const language = isSupportedLanguage(body.language) ? body.language : DEFAULT_LANGUAGE;

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.code(409).send({
        error: 'Conflict',
        message: 'An account with that email already exists.',
        statusCode: 409,
      });
    }

    // The first account becomes ADMIN. Without this a fresh install has nobody
    // who can approve counsellors, and the directory can never be populated.
    const isFirstAccount = (await prisma.user.count()) === 0;

    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash: await bcrypt.hash(body.password, 12),
        displayName: body.displayName,
        language,
        role: isFirstAccount ? 'ADMIN' : 'USER',
      },
    });

    const token = app.jwt.sign({ sub: user.id, role: user.role as PublicUser['role'] });
    return reply.code(201).send({ token, user: toPublicUser(user) });
  });

  app.post('/auth/login', async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });

    // Same response for unknown email and wrong password — a distinct 404 here
    // would turn this endpoint into an account-enumeration oracle.
    const ok = user ? await bcrypt.compare(body.password, user.passwordHash) : false;
    if (!user || !ok) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Incorrect email or password.',
        statusCode: 401,
      });
    }

    const token = app.jwt.sign({ sub: user.id, role: user.role as PublicUser['role'] });
    return reply.send({ token, user: toPublicUser(user) });
  });

  app.get('/auth/me', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user) {
      return reply.code(404).send({ error: 'Not Found', message: 'Account not found.', statusCode: 404 });
    }
    return reply.send(toPublicUser(user));
  });

  app.patch('/auth/me', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = updateSchema.parse(req.body);
    const data: Record<string, string> = {};
    if (body.displayName) data.displayName = body.displayName;
    if (body.language && isSupportedLanguage(body.language)) data.language = body.language;

    const user = await prisma.user.update({ where: { id: req.user.sub }, data });
    return reply.send(toPublicUser(user));
  });
}
