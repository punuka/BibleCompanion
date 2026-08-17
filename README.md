# Bible Companion

A cross-platform app for reading and talking about the Bible. Three surfaces:

- **Chat** — an AI companion grounded in scripture, streaming token-by-token, in the language you choose.
- **Comfort** — describe what you are going through; get consoling passages, a reflection, and a prayer.
- **Counsellors** — a directory of real people who registered and were approved by an admin, and in-app messaging with them.

iOS and Android from one codebase (Expo / React Native), with a TypeScript API in front of Gemini.

---

## Quick start

```bash
npm install
cp apps/api/.env.example apps/api/.env      # then add your GEMINI_API_KEY
cp apps/mobile/.env.example apps/mobile/.env
npm run setup                                # builds shared, creates the DB, seeds verses

npm run dev:api                              # http://localhost:8787
npm run dev:mobile                           # Expo dev server, then press a / i / w
```

The **first account you register becomes ADMIN** — that is the account that can approve counsellor applications.

### Requirements

| | |
|---|---|
| Node | 20+ (developed on 24) |
| A Gemini API key (free tier) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Android emulator | optional — Android Studio; see below |
| iOS simulator | macOS only; use Expo Go on a real iPhone from Windows |

---

## Where things are

```
apps/api            Fastify + Prisma + Claude. Owns every model call.
apps/mobile         Expo + expo-router. iOS, Android, web.
packages/shared     Types, language registry, situations. Used by both.
.claude/skills/     The bible-companion skill: how to extend this codebase.
```

The `.claude/skills/bible-companion/` directory is the real documentation — architecture, prompt design, the counsellor lifecycle, and emulator setup. Start at its `SKILL.md`.

## Stack, and why

| Choice | Reason |
|---|---|
| **Expo / React Native** | One TypeScript codebase for iOS and Android. No native modules yet, so it runs in Expo Go — no Xcode or Android Studio needed to iterate. |
| **Fastify + Prisma** | The API key never ships to the device. Prisma keeps SQLite (dev) and Postgres (prod) on one schema. |
| **Claude Opus 5** | Pastoral tone and multilingual fluency are the product. Cost is managed with the `effort` parameter, not by downgrading the model. |
| **SQLite → Postgres** | Zero-setup local dev; production is a two-line change (`provider` + `DATABASE_URL`). |

## How it hangs together

```
Expo app ──HTTPS + JWT──► Fastify ──► Prisma ──► SQLite / Postgres
                             │
                             ├──► Claude (streamed back to the app as SSE)
                             └──► Verse store (the ONLY source of quoted scripture)
```

## Three things this codebase takes seriously

**Scripture is never invented.** The model may only quote verses returned by the `bible_lookup` / `bible_search` tools. A model this capable "knows" the Bible — and also confabulates references under pressure. The comfort endpoint additionally re-verifies every returned reference against the store and drops any that do not resolve.

**Crisis signals are handled before the model, not by it.** A pattern screen runs on every inbound message. On a hit, hotline resources are pinned above the reply, non-dismissible. A model can be argued out of a refusal; a regex cannot.

**Unapproved counsellors are never visible.** Applications land as `PENDING`. Only an `ADMIN` can approve, only one function serves the public directory, and the client cannot set its own status — the field is stripped server-side.

## Running the tests

```bash
npm test          # 51 tests: safety screen, approval gate, reference parsing, prompt-cache stability
npm run typecheck # shared + api + mobile
```

No test hits the live Claude API.

## Connecting the app to the API

`localhost` means "this device", so it is wrong for most targets:

| Target | `EXPO_PUBLIC_API_URL` |
|---|---|
| Web preview | `http://localhost:8787` |
| Android emulator | `http://10.0.2.2:8787` |
| iOS simulator | `http://localhost:8787` |
| Physical device | `http://<your-LAN-IP>:8787` |

Restart the Expo dev server after changing it — it is inlined at bundle time. Full guidance, including Android Studio setup and `adb reverse`, is in `.claude/skills/bible-companion/references/emulators.md`.

## Bible text

Seeded with ~110 verses: World English Bible (English) and Reina-Valera Antigua (Spanish), both public domain, tagged with themes for the comfort flow. This is a **starter corpus, not a complete Bible** — enough to exercise every code path.

To load a full Bible, drop a `verses.<lang>.json` into `apps/api/data/` (`{ ref, book, chapter, verse, text, themes[] }`) and run `npm run db:seed -w apps/api`. The seeder is idempotent, and the language code comes from the filename. Use public-domain or properly licensed translations only.

Languages with no seeded corpus still work — lookups fall back to English rather than letting the model claim a passage does not exist.

## Adding a language

1. Add the entry to `packages/shared/src/languages.ts`.
2. Add UI strings in `apps/mobile/src/i18n/strings.ts` (optional — chrome falls back to English while AI replies and verses are still fully translated).
3. Optionally add `apps/api/data/verses.<code>.json`.

The system prompt builder, counsellor filter, and language picker all read the registry, so nothing else needs touching.

## Deploying

- **API** — any Node host. Set `DATABASE_URL` to Postgres, flip `provider` in `prisma/schema.prisma`, run `prisma migrate deploy`. Set a real `JWT_SECRET`; rotating it invalidates every session.
- **Mobile** — `eas build -p android` / `eas build -p ios`. iOS builds need an Apple Developer account; EAS runs the macOS builders for you, so this works from Windows.

## Status

Verified working: auth and roles, the counsellor approval gate, connection lifecycle and messaging, Bible lookup/search with cross-language fallback, the safety screen, database seeding, and a full Android bundle. The chat and comfort surfaces need a real `GEMINI_API_KEY` to exercise end to end.

Not built, deliberately: payments, scheduling, counsellor ratings, automated credential verification, and push notifications. The reasoning for each is in `.claude/skills/bible-companion/references/counselors.md`.
