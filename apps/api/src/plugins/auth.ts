import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@bible/shared';
import { env } from '../env.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      ...roles: Role[]
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role: Role };
    user: { sub: string; role: Role };
  }
}

export default fp(async function authPlugin(app: FastifyInstance) {
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: '30d' },
  });

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid authentication token.',
        statusCode: 401,
      });
    }
  });

  /**
   * Composes on top of `authenticate` — it verifies the token itself, so a
   * route using requireRole does not also need authenticate in its preHandler.
   */
  app.decorate('requireRole', (...roles: Role[]) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await req.jwtVerify();
      } catch {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Missing or invalid authentication token.',
          statusCode: 401,
        });
      }
      if (!roles.includes(req.user.role)) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: `This action requires one of: ${roles.join(', ')}.`,
          statusCode: 403,
        });
      }
    };
  });
});
