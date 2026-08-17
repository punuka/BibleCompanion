---
name: bible-companion
description: Build, extend, run, and test the Bible Companion app — a cross-platform (iOS/Android) Expo + Fastify app for multilingual AI Bible chat, situation-based spiritual/emotional comfort, and connecting with approved spiritual counsellors. Use when adding chat features, prompts, languages, Bible data, counsellor/approval flows, safety handling, API endpoints, mobile screens, or when running the app on emulators/devices.
---

# Bible Companion

A monorepo for a Bible chat app. Two apps, one shared package:

| Path | What it is |
|---|---|
| `apps/api` | Fastify + TypeScript + Prisma. Owns auth, Gemini calls, Bible data, counsellor directory. |
| `apps/mobile` | Expo (React Native) + expo-router + TypeScript. iOS, Android, and web from one source. |
| `packages/shared` | Types, language registry, API contract. Imported by both. |

Read `references/architecture.md` before changing anything that crosses the API/mobile boundary.

## The three product surfaces

1. **Chat** — free-form conversation with a Bible-grounded assistant. Streams token-by-token over SSE.
2. **Comfort** — user describes a situation ("I lost my job", "my marriage is failing"); the app returns consoling scripture, a short reflection, and a prayer. Structured JSON, not free text.
3. **Counsellors** — a directory of humans who registered and were **approved by an admin**. Users request a connection; approved counsellors accept and message inside the app.

## Non-negotiables

These are correctness rules for this codebase, not style preferences.

- **Never invent scripture.** Every verse the model quotes must come from `bible.lookup` / `bible.search` tool results. The system prompt states this and the tools enforce it. If you add a code path where the model quotes without the tool, you have introduced a bug.
- **Never let the app act as a crisis service.** `apps/api/src/services/safety.ts` screens every inbound message. On a positive signal the response leads with crisis resources and offers a human counsellor. Do not "improve" this by routing it through the model first — the check runs before the model and its output is prepended, not generated.
- **Never expose an unapproved counsellor.** Directory queries filter on `status: APPROVED`. Applications land as `PENDING`. Only `ADMIN` role can transition status.
- **The user's language is chosen, not detected.** `user.language` drives the system prompt, the verse translation, and the counsellor filter. Do not add language auto-detection that overrides an explicit choice.
- **No pastoral advice on medical, legal, or financial specifics.** The system prompt declines and redirects; keep that clause if you edit it.

## Gemini API usage

The current contract in `apps/api/src/services/gemini/`:

- Model `gemini-2.5-flash` for chat and comfort; `gemini-2.5-flash-lite` for the cheap title/summary pass. Both run on the Gemini free tier — a key from `aistudio.google.com`, no billing required.
- Chat streams (`genai.models.generateContentStream`) so long replies don't hit HTTP timeouts.
- Comfort runs in two phases — freeform tool-calling to gather verses, then one final no-tools call with `responseMimeType: "application/json"` + `responseJsonSchema`. Function calling and structured output are not combined in a single request.
- `prompts.ts` is provider-agnostic (plain strings via `config.systemInstruction`).

Details and the full prompt rationale: `references/ai-chat.md`.

## Common tasks

### Run it locally
```bash
npm install                 # once, at the repo root
npm run db:setup -w apps/api
npm run dev -w apps/api     # http://localhost:8787
npm run dev -w apps/mobile  # Expo dev server
```
`apps/api/.env` needs `GEMINI_API_KEY` (free tier key from `aistudio.google.com`). The mobile app needs `EXPO_PUBLIC_API_URL` pointing at a host the device/emulator can reach — `localhost` is wrong for Android emulators. See `references/emulators.md`.

### Add a language
Add the entry to `packages/shared/src/languages.ts` (code, English name, endonym, RTL flag, preferred Bible translation). Add the UI dictionary to `apps/mobile/src/i18n/strings.ts`. Nothing else — the system prompt builder and counsellor filter read the registry. Verify RTL languages render with `I18nManager`.

### Add a Bible translation or more verses
`apps/api/prisma/seed.ts` loads `apps/api/data/verses.*.json`. Files are `{ ref, book, chapter, verse, text, translation, language, themes[] }`. Re-run `npm run db:seed -w apps/api`. Only add public-domain or licensed text.

### Add a comfort situation category
`packages/shared/src/situations.ts`, then re-run the seed so the theme tags line up with verses.

### Change the counsellor approval flow
`apps/api/src/routes/admin.ts` and `apps/api/src/routes/counselors.ts`. Any new status must keep the directory filter at `APPROVED` only.

## Testing

```bash
npm test -w apps/api           # vitest — safety screen, approval gates, verse tools
npm run typecheck              # both workspaces
```
Gemini calls are mocked in tests. Never add a test that hits the live API — it makes the suite non-deterministic on every CI run.

## References

- `references/architecture.md` — data model, request flow, auth, API contract
- `references/ai-chat.md` — prompts, tools, streaming, safety, structured comfort output
- `references/counselors.md` — registration → approval → connection → messaging lifecycle
- `references/emulators.md` — Android/iOS emulator setup, device testing, networking
