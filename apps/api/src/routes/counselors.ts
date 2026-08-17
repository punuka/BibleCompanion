import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SPECIALTIES, isSupportedLanguage } from '@bible/shared';
import { prisma } from '../lib/prisma.js';
import { stringify } from '../lib/json.js';
import { getApprovedById, listApproved, toPublicProfile } from '../services/counselors.js';

const applySchema = z.object({
  headline: z.string().min(10).max(140).trim(),
  bio: z.string().min(100, 'Tell people something substantial about your work').max(2000).trim(),
  languages: z.array(z.string()).min(1).max(10),
  specialties: z.array(z.enum(SPECIALTIES)).min(1).max(6),
  credentials: z.string().min(10).max(2000).trim(),
  organization: z.string().max(140).trim().optional(),
  yearsExperience: z.number().int().min(0).max(80),
  contactEmail: z.string().email(),
  // `status` is deliberately absent. Even if a client sends it, Zod strips it —
  // there is no client-side path to self-approval.
});

const connectSchema = z.object({
  topic: z.string().min(5).max(300).trim(),
  language: z.string().optional(),
});

const directoryQuery = z.object({
  language: z.string().optional(),
  specialty: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export default async function counselorRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  /** Public directory. APPROVED only — enforced inside listApproved(). */
  app.get('/counselors', async (req) => {
    const query = directoryQuery.parse(req.query);
    return listApproved(query);
  });

  app.get<{ Params: { id: string } }>('/counselors/:id', async (req, reply) => {
    const profile = await getApprovedById(req.params.id);
    if (!profile) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'No approved counsellor with that id.',
        statusCode: 404,
      });
    }
    return reply.send(profile);
  });

  /** Apply to become a counsellor. Lands as PENDING; role does not change yet. */
  app.post('/counselors/apply', async (req, reply) => {
    const body = applySchema.parse(req.body);

    const unsupported = body.languages.filter((l) => !isSupportedLanguage(l));
    if (unsupported.length > 0) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: `Unsupported language codes: ${unsupported.join(', ')}`,
        statusCode: 400,
      });
    }

    const existing = await prisma.counselorProfile.findUnique({
      where: { userId: req.user.sub },
    });

    // Re-applying after rejection is allowed and resets to PENDING; editing an
    // already-approved profile must not silently un-approve it, so approved
    // profiles keep their status.
    const data = {
      headline: body.headline,
      bio: body.bio,
      languages: stringify(body.languages),
      specialties: stringify(body.specialties),
      credentials: body.credentials,
      organization: body.organization ?? null,
      yearsExperience: body.yearsExperience,
      contactEmail: body.contactEmail,
    };

    const profile = existing
      ? await prisma.counselorProfile.update({
          where: { userId: req.user.sub },
          data: {
            ...data,
            status: existing.status === 'APPROVED' ? 'APPROVED' : 'PENDING',
            reviewNote: existing.status === 'APPROVED' ? existing.reviewNote : null,
          },
          include: { user: { select: { displayName: true } } },
        })
      : await prisma.counselorProfile.create({
          data: { ...data, userId: req.user.sub, status: 'PENDING' },
          include: { user: { select: { displayName: true } } },
        });

    return reply.code(existing ? 200 : 201).send(toPublicProfile(profile));
  });

  /** The applicant's own view of their application, whatever its status. */
  app.get('/counselors/me/application', async (req, reply) => {
    const profile = await prisma.counselorProfile.findUnique({
      where: { userId: req.user.sub },
      include: { user: { select: { displayName: true } } },
    });
    if (!profile) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'You have not applied yet.',
        statusCode: 404,
      });
    }
    return reply.send({ ...toPublicProfile(profile), reviewNote: profile.reviewNote });
  });

  /** Request a connection with an approved counsellor. */
  app.post<{ Params: { id: string } }>('/counselors/:id/connect', async (req, reply) => {
    const body = connectSchema.parse(req.body);

    const counselor = await getApprovedById(req.params.id);
    if (!counselor) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'No approved counsellor with that id.',
        statusCode: 404,
      });
    }

    const profile = await prisma.counselorProfile.findUniqueOrThrow({
      where: { id: req.params.id },
    });
    if (profile.userId === req.user.sub) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'You cannot request a connection with yourself.',
        statusCode: 400,
      });
    }

    const open = await prisma.connection.findFirst({
      where: {
        userId: req.user.sub,
        counselorProfileId: req.params.id,
        status: { in: ['REQUESTED', 'ACCEPTED'] },
      },
    });
    if (open) {
      return reply.code(409).send({
        error: 'Conflict',
        message: 'You already have an open connection with this counsellor.',
        statusCode: 409,
        connectionId: open.id,
      });
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.sub } });
    const connection = await prisma.connection.create({
      data: {
        userId: req.user.sub,
        counselorProfileId: req.params.id,
        topic: body.topic,
        language: body.language && isSupportedLanguage(body.language) ? body.language : user.language,
        status: 'REQUESTED',
      },
    });

    return reply.code(201).send({
      id: connection.id,
      status: connection.status,
      topic: connection.topic,
      language: connection.language,
      createdAt: connection.createdAt.toISOString(),
    });
  });
}
