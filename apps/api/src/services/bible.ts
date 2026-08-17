import type { Citation, Verse } from '@bible/shared';
import { getLanguage } from '@bible/shared';
import { prisma } from '../lib/prisma.js';
import { parseList } from '../lib/json.js';

interface VerseRow {
  ref: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  translation: string;
  language: string;
  themes: string;
}

function toVerse(row: VerseRow): Verse {
  return { ...row, themes: parseList(row.themes) };
}

export function toCitation(v: Verse): Citation {
  return { ref: v.ref, text: v.text, translation: v.translation };
}

/**
 * Parses "John 14:27", "1 Corinthians 13:4", "Psalm 23:1-3".
 * Returns null on anything it cannot confidently read — callers must treat a
 * null as "not found" rather than guessing, so the model never gets a
 * silently-wrong verse back.
 */
export function parseRef(
  ref: string,
): { book: string; chapter: number; verse: number; endVerse: number } | null {
  const m = /^\s*((?:[1-3]\s+)?[A-Za-zÀ-ɏ.]+(?:\s+[A-Za-zÀ-ɏ.]+)*)\s+(\d+):(\d+)(?:\s*[-–]\s*(\d+))?\s*$/.exec(
    ref,
  );
  if (!m) return null;
  const [, book, chapter, verse, endVerse] = m;
  if (!book || !chapter || !verse) return null;
  return {
    book: book.trim().replace(/\.$/, ''),
    chapter: Number(chapter),
    verse: Number(verse),
    endVerse: endVerse ? Number(endVerse) : Number(verse),
  };
}

export async function lookup(ref: string, language: string): Promise<Verse[]> {
  const parsed = parseRef(ref);
  if (!parsed) return [];

  const { translation } = getLanguage(language);

  const rows = await prisma.verse.findMany({
    where: {
      language,
      book: { equals: parsed.book },
      chapter: parsed.chapter,
      verse: { gte: parsed.verse, lte: parsed.endVerse },
    },
    orderBy: { verse: 'asc' },
  });

  // Fall back to English if this language has no seeded text for the passage.
  // Returning nothing would make the model claim the verse does not exist,
  // which is worse than showing it in another translation.
  if (rows.length === 0 && language !== 'en') {
    const fallback = await prisma.verse.findMany({
      where: {
        language: 'en',
        book: { equals: parsed.book },
        chapter: parsed.chapter,
        verse: { gte: parsed.verse, lte: parsed.endVerse },
      },
      orderBy: { verse: 'asc' },
    });
    return fallback.map(toVerse);
  }

  return rows.filter((r) => r.translation === translation || true).map(toVerse);
}

export async function search(opts: {
  query?: string;
  theme?: string;
  language: string;
  limit?: number;
}): Promise<Verse[]> {
  const limit = Math.min(Math.max(opts.limit ?? 6, 1), 25);

  const and: Record<string, unknown>[] = [{ language: opts.language }];
  if (opts.query) and.push({ text: { contains: opts.query } });
  // themes is a JSON string column; a substring match on the quoted theme is
  // exact enough because theme tokens are kebab-case and never overlap.
  if (opts.theme) and.push({ themes: { contains: `"${opts.theme}"` } });

  let rows = await prisma.verse.findMany({ where: { AND: and }, take: limit });

  if (rows.length === 0 && opts.language !== 'en') {
    const enAnd = and.map((c) => ('language' in c ? { language: 'en' } : c));
    rows = await prisma.verse.findMany({ where: { AND: enAnd }, take: limit });
  }

  return rows.map(toVerse);
}

/** Do these references actually resolve? Used to drop hallucinated citations. */
export async function verifyRefs(refs: string[], language: string): Promise<Set<string>> {
  const found = new Set<string>();
  await Promise.all(
    refs.map(async (ref) => {
      const verses = await lookup(ref, language);
      if (verses.length > 0) found.add(ref);
    }),
  );
  return found;
}
