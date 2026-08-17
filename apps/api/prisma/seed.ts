import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { getLanguage, isSupportedLanguage } from '@bible/shared';

const prisma = new PrismaClient();
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

interface SeedVerse {
  ref: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  themes: string[];
  /** Optional per-verse override; otherwise the language's default translation. */
  translation?: string;
}

/**
 * Loads every `verses.<lang>.json` in data/. The language code comes from the
 * filename, and the translation from the language registry — so adding a
 * language's corpus is a matter of dropping in one correctly named file.
 */
async function seedVerses(): Promise<void> {
  const files = (await readdir(DATA_DIR)).filter(
    (f) => f.startsWith('verses.') && f.endsWith('.json'),
  );

  if (files.length === 0) {
    console.warn('No verses.*.json files found in data/ — the Bible tools will return nothing.');
    return;
  }

  let total = 0;

  for (const file of files) {
    const language = file.slice('verses.'.length, -'.json'.length);
    if (!isSupportedLanguage(language)) {
      console.warn(`Skipping ${file}: "${language}" is not in the language registry.`);
      continue;
    }

    const defaultTranslation = getLanguage(language).translation;
    const verses = JSON.parse(await readFile(join(DATA_DIR, file), 'utf8')) as SeedVerse[];

    for (const v of verses) {
      const translation = v.translation ?? defaultTranslation;
      const data = {
        ref: v.ref,
        book: v.book,
        chapter: v.chapter,
        verse: v.verse,
        text: v.text,
        translation,
        language,
        themes: JSON.stringify(v.themes ?? []),
      };
      // Upsert so re-seeding is idempotent — you can add verses to a file and
      // re-run without wiping the database.
      await prisma.verse.upsert({
        where: { ref_translation: { ref: v.ref, translation } },
        create: data,
        update: data,
      });
    }

    total += verses.length;
    console.log(`  ${language}: ${verses.length} verses (${defaultTranslation})`);
  }

  console.log(`Seeded ${total} verses across ${files.length} language file(s).`);
}

async function main(): Promise<void> {
  console.log('Seeding Bible Companion database...');
  await seedVerses();

  const users = await prisma.user.count();
  if (users === 0) {
    console.log(
      '\nNo accounts yet. The FIRST account you register becomes ADMIN —\n' +
        'that is the account that can approve counsellor applications.',
    );
  }
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
