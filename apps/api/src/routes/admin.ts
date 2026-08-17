import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { toApplication } from '../services/counselors.js';

const listQuery = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']).optional(),
});

const decisionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'SUSPENDED']),
  note: z.string().max(1000).trim().optional(),
});

export default async function adminRoutes(app: FastifyInstance) {
  // Every route in this plugin is admin-only. requireRole verifies the token
  // itself, so no separate authenticate hook is needed.
  app.addHook('preHandler', app.requireRole('ADMIN'));

  /** Review queue. Defaults to PENDING because that is the actionable set. */
  app.get('/admin/counselors', async (req) => {
    const query = listQuery.parse(req.query);
    const rows = await prisma.counselorProfile.findMany({
      where: { status: query.status ?? 'PENDING' },
      include: { user: { select: { displayName: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toApplication);
  });

  /**
   * The only path that can change a counsellor's status.
   *
   * User.role moves in lockstep: COUNSELOR on approval, USER otherwise. If
   * these two ever drift you get counsellors with counsellor-only route access
   * who are invisible in the directory, or the reverse.
   */
  app.post<{ Params: { id: string } }>('/admin/counselors/:id/decision', async (req, reply) => {
    const body = decisionSchema.parse(req.body);

    const profile = await prisma.counselorProfile.findUnique({ where: { id: req.params.id } });
    if (!profile) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'No such counsellor application.',
        statusCode: 404,
      });
    }

    const approved = body.status === 'APPROVED';

    const [updated] = await prisma.$transaction([
      prisma.counselorProfile.update({
        where: { id: req.params.id },
        data: {
          status: body.status,
          reviewNote: body.note ?? null,
          approvedAt: approved ? new Date() : null,
        },
        include: { user: { select: { displayName: true } } },
      }),
      prisma.user.update({
        where: { id: profile.userId },
        data: { role: approved ? 'COUNSELOR' : 'USER' },
      }),
    ]);

    req.log.info(
      { counselorProfileId: req.params.id, status: body.status, adminId: req.user.sub },
      'counsellor application decision',
    );

    return reply.send(toApplication(updated));
  });

  app.get('/admin/stats', async () => {
    const [users, counselors, pending, conversations, comfort, connections] = await Promise.all([
      prisma.user.count(),
      prisma.counselorProfile.count({ where: { status: 'APPROVED' } }),
      prisma.counselorProfile.count({ where: { status: 'PENDING' } }),
      prisma.conversation.count(),
      prisma.comfortSession.count(),
      prisma.connection.count({ where: { status: 'ACCEPTED' } }),
    ]);
    return {
      users,
      approvedCounselors: counselors,
      pendingApplications: pending,
      conversations,
      comfortSessions: comfort,
      activeConnections: connections,
    };
  });
}
