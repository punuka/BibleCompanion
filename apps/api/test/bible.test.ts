import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/prisma.js', () => ({
  prisma: { verse: { findMany: vi.fn().mockResolvedValue([]) } },
}));

const { parseRef } = await import('../src/services/bible.js');

/**
 * parseRef must return null rather than guessing. A wrong parse means the tool
 * silently returns the wrong verse, which is worse than returning nothing —
 * the model would quote it in good faith.
 */
describe('reference parsing', () => {
  it('parses a plain reference', () => {
    expect(parseRef('John 14:27')).toEqual({
      book: 'John',
      chapter: 14,
      verse: 27,
      endVerse: 27,
    });
  });

  it('parses a numbered book', () => {
    expect(parseRef('1 Corinthians 13:4')).toEqual({
      book: '1 Corinthians',
      chapter: 13,
      verse: 4,
      endVerse: 4,
    });
  });

  it('parses a verse range', () => {
    expect(parseRef('Psalm 23:1-4')).toEqual({
      book: 'Psalm',
      chapter: 23,
      verse: 1,
      endVerse: 4,
    });
  });

  it('parses an en-dash range', () => {
    expect(parseRef('Romans 8:38–39')?.endVerse).toBe(39);
  });

  it('parses accented book names for non-English corpora', () => {
    expect(parseRef('Isaías 41:10')).toEqual({
      book: 'Isaías',
      chapter: 41,
      verse: 10,
      endVerse: 10,
    });
  });

  it('strips a trailing abbreviation dot', () => {
    expect(parseRef('Phil. 4:13')?.book).toBe('Phil');
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseRef('  John 3:16  ')?.verse).toBe(16);
  });

  const unparseable = ['John', 'John 14', '14:27', '', 'the twenty third psalm', 'John 14:'];
  for (const input of unparseable) {
    it(`returns null rather than guessing at: "${input}"`, () => {
      expect(parseRef(input)).toBeNull();
    });
  }
});
