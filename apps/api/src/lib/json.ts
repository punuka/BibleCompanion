/**
 * JSON-as-TEXT column helpers.
 *
 * Array/object fields are stored as JSON strings so the Prisma schema works
 * unchanged on both SQLite (dev) and Postgres (prod). Always go through these
 * helpers rather than calling JSON.parse at the call site: a malformed or
 * legacy-null column should degrade to an empty list, not throw inside a route.
 */

export function parseList<T = string>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

export function parseObject<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' ? (value as T) : null;
  } catch {
    return null;
  }
}

export function stringify(value: unknown): string {
  return JSON.stringify(value ?? null);
}
