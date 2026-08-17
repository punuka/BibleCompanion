import { beforeEach, describe, expect, it, vi } from 'vitest';

const findMany = vi.fn();
const findFirst = vi.fn();

vi.mock('../src/lib/prisma.js', () => ({
  prisma: { counselorProfile: { findMany, findFirst } },
}));

const { listApproved, getApprovedById, toPublicProfile } = await import(
  '../src/services/counselors.js'
);

/**
 * The approval gate. Every public listing of counsellors flows through
 * listApproved(), and these tests exist to make sure it stays that way — an
 * unapproved counsellor reaching the directory is the worst failure this
 * feature can have.
 */
describe('approval gate', () => {
  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([]);
    findFirst.mockReset().mockResolvedValue(null);
  });

  it('always constrains the directory query to APPROVED', async () => {
    await listApproved({});
    const where = findMany.mock.calls[0]![0].where as { AND: Record<string, unknown>[] };
    expect(where.AND).toContainEqual({ status: 'APPROVED' });
  });

  it('keeps the APPROVED constraint when filters are applied', async () => {
    await listApproved({ language: 'sw', specialty: 'grief-and-bereavement' });
    const where = findMany.mock.calls[0]![0].where as { AND: Record<string, unknown>[] };
    expect(where.AND).toContainEqual({ status: 'APPROVED' });
    expect(where.AND).toContainEqual({ languages: { contains: '"sw"' } });
    expect(where.AND).toContainEqual({ specialties: { contains: '"grief-and-bereavement"' } });
  });

  it('never returns a pending profile by id', async () => {
    await getApprovedById('cp_1');
    expect(findFirst.mock.calls[0]![0].where).toEqual({ id: 'cp_1', status: 'APPROVED' });
  });

  it('caps the page size regardless of the requested limit', async () => {
    await listApproved({ limit: 10_000 });
    expect(findMany.mock.calls[0]![0].take).toBe(100);
  });
});

describe('public profile shape', () => {
  const row = {
    id: 'cp_1',
    headline: 'Grief counsellor, 12 years',
    bio: 'A long bio.',
    languages: '["en","sw"]',
    specialties: '["grief-and-bereavement"]',
    organization: 'Hope Centre',
    yearsExperience: 12,
    status: 'APPROVED',
    approvedAt: new Date('2026-01-01'),
    createdAt: new Date('2025-12-01'),
    user: { displayName: 'Ruth M.' },
  };

  it('never leaks reviewer-only fields', () => {
    const profile = toPublicProfile(row) as unknown as Record<string, unknown>;
    expect(profile).not.toHaveProperty('credentials');
    expect(profile).not.toHaveProperty('contactEmail');
    expect(profile).not.toHaveProperty('reviewNote');
    expect(profile).not.toHaveProperty('userId');
  });

  it('parses the JSON-as-text list columns', () => {
    const profile = toPublicProfile(row);
    expect(profile.languages).toEqual(['en', 'sw']);
    expect(profile.specialties).toEqual(['grief-and-bereavement']);
  });

  it('degrades a malformed list column to empty rather than throwing', () => {
    const profile = toPublicProfile({ ...row, languages: 'not json' });
    expect(profile.languages).toEqual([]);
  });
});
