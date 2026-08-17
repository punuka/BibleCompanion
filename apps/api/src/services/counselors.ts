import type { CounselorApplication, CounselorProfile } from '@bible/shared';
import { prisma } from '../lib/prisma.js';
import { parseList } from '../lib/json.js';

/**
 * THE approval gate.
 *
 * Every public listing of counsellors goes through this function. If you add a
 * "featured", "recently active", or search endpoint, call this — do not write
 * another prisma.counselorProfile.findMany. That indirection is the only thing
 * standing between a schema change and an unapproved counsellor going live.
 */
export async function listApproved(filters: {
  language?: string;
  specialty?: string;
  limit?: number;
}): Promise<CounselorProfile[]> {
  const and: Record<string, unknown>[] = [{ status: 'APPROVED' }];
  if (filters.language) and.push({ languages: { contains: `"${filters.language}"` } });
  if (filters.specialty) and.push({ specialties: { contains: `"${filters.specialty}"` } });

  const rows = await prisma.counselorProfile.findMany({
    where: { AND: and },
    include: { user: { select: { displayName: true } } },
    orderBy: { approvedAt: 'desc' },
    take: Math.min(Math.max(filters.limit ?? 50, 1), 100),
  });

  return rows.map(toPublicProfile);
}

export async function getApprovedById(id: string): Promise<CounselorProfile | null> {
  const row = await prisma.counselorProfile.findFirst({
    where: { id, status: 'APPROVED' },
    include: { user: { select: { displayName: true } } },
  });
  return row ? toPublicProfile(row) : null;
}

type ProfileRow = {
  id: string;
  headline: string;
  bio: string;
  languages: string;
  specialties: string;
  organization: string | null;
  yearsExperience: number;
  status: string;
  approvedAt: Date | null;
  createdAt: Date;
  user: { displayName: string };
};

/** Public shape. Note what is absent: credentials, contactEmail, reviewNote. */
export function toPublicProfile(row: ProfileRow): CounselorProfile {
  return {
    id: row.id,
    displayName: row.user.displayName,
    headline: row.headline,
    bio: row.bio,
    languages: parseList(row.languages),
    specialties: parseList(row.specialties),
    organization: row.organization,
    yearsExperience: row.yearsExperience,
    status: row.status as CounselorProfile['status'],
    approvedAt: row.approvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Admin-only shape. Adds the fields a reviewer needs and the public never sees. */
export function toApplication(
  row: ProfileRow & { credentials: string; contactEmail: string; reviewNote: string | null; userId: string },
): CounselorApplication {
  return {
    ...toPublicProfile(row),
    credentials: row.credentials,
    contactEmail: row.contactEmail,
    reviewNote: row.reviewNote,
    userId: row.userId,
  };
}
