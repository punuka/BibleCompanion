# Bible Companion

A cross-platform app for reading and talking about the Bible. Four surfaces:

- **Chat** — an AI companion grounded in scripture, streaming token-by-token, in the language you choose. Tapping "New conversation" reuses an existing empty thread instead of piling up blank ones.
- **Comfort** — describe what you are going through; get consoling passages, a reflection, and a prayer. Past reflections are saved and browsable from a history list.
- **Counsellors** — a directory of real people who registered and were approved by an admin, and in-app messaging with them.
- **Admin dashboard** — for the `ADMIN` role: review pending counsellor applications, approve/reject/suspend them, and see usage stats (users, conversations, comfort sessions, active connections).

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

The **first account you register becomes ADMIN** — that is the account that can approve counsellor applications and see the admin dashboard (Profile tab → Admin dashboard, once signed in as that account).

### Requirements

| | |
|---|---|
| Node | 20+ (developed on 24) |
| A Gemini API key (free tier) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — required |
| A Groq API key (free tier) | [console.groq.com/keys](https://console.groq.com/keys) — optional, see below |
| Android emulator | optional — Android Studio; see below |
| iOS simulator | macOS only; use Expo Go on a real iPhone from Windows/Linux |

Gemini is the only AI provider that's required. Groq is an **optional fallback** — if `GROQ_API_KEY` is set, Chat and Comfort automatically retry on Groq when Gemini errors out (quota exhausted, an overloaded model, an outage). Gemini is always tried first; Groq only ever steps in after a Gemini failure, never in place of it. Leave `GROQ_API_KEY` blank to run without a fallback — everything still works, Gemini's error just surfaces as-is when it fails.

---

## Where things are

```
apps/api            Fastify + Prisma + Gemini/Groq. Owns every model call.
apps/mobile         Expo + expo-router. iOS, Android, web.
packages/shared     Types, language registry, situations. Used by both.
.claude/skills/     The bible-companion skill: how to extend this codebase.
Dockerfile          Builds apps/api from the full monorepo (see Deploying).
fly.toml            Fly.io app config — the reference deployment target.
```

The `.claude/skills/bible-companion/` directory is the real documentation — architecture, prompt design, the counsellor lifecycle, and emulator setup. Start at its `SKILL.md`.

## Stack, and why

| Choice | Reason |
|---|---|
| **Expo / React Native** | One TypeScript codebase for iOS and Android. No native modules required to iterate — runs in Expo Go until you need a custom native build (e.g. a signed release APK). |
| **Fastify + Prisma** | The API key never ships to the device. Prisma keeps SQLite (dev) and Postgres (prod) on one schema. |
| **Gemini, with Groq as fallback** | Gemini (`gemini-flash-latest`) is primary for its multilingual tone and Bible-tool grounding. Groq (`openai/gpt-oss-120b`) only activates when Gemini itself fails, so a provider outage or quota spike doesn't take the app down. |
| **SQLite → Postgres** | Zero-setup local dev; production is a two-line change (`provider` + `DATABASE_URL`) — or just keep SQLite on a persistent volume, as the included Fly.io config does. |

## How it hangs together

```
Expo app ──HTTPS + JWT──► Fastify ──► Prisma ──► SQLite / Postgres
                             │
                             ├──► Gemini (primary) ──► Groq (fallback, on Gemini failure only)
                             │        streamed back to the app as SSE
                             └──► Verse store (the ONLY source of quoted scripture)
```

## Things this codebase takes seriously

**Scripture is never invented.** The model may only quote verses returned by the `bible_lookup` / `bible_search` tools. A model this capable "knows" the Bible — and also confabulates references under pressure. The comfort endpoint additionally re-verifies every returned reference against the store and drops any that do not resolve.

**Crisis signals are handled before the model, not by it.** A pattern screen runs on every inbound message. On a hit, hotline resources are pinned above the reply, non-dismissible. A model can be argued out of a refusal; a regex cannot.

**Unapproved counsellors are never visible.** Applications land as `PENDING`. Only an `ADMIN` can approve, only one function serves the public directory, and the client cannot set its own status — the field is stripped server-side.

**Gemini is never silently replaced.** Groq is wired as a fallback, not an alternative — it only runs after Gemini has already thrown, and only if a response hasn't started streaming yet. Logs distinguish which provider actually served each request.

## Running the tests

```bash
npm test          # vitest: safety screen, approval gate, reference parsing, Bible tool lookups
npm run typecheck # shared + api + mobile
```

No test hits the live Gemini or Groq API — both are mocked.

## Connecting the app to the API

`localhost` means "this device", so it is wrong for most targets:

| Target | `EXPO_PUBLIC_API_URL` |
|---|---|
| Web preview | `http://localhost:8787` |
| Android emulator | `http://10.0.2.2:8787` |
| iOS simulator | `http://localhost:8787` |
| Physical device, same LAN/hotspot | `http://<your-LAN-IP>:8787` |
| Physical device, anywhere | `https://<your-deployed-api>` (see Deploying) |

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

---

## Platform requirements

You only need the pieces for what you're actually doing: the API and web preview run anywhere Node runs; a native Android build additionally needs the Android SDK toolchain; a native iOS build needs a Mac.

| | macOS | Linux | Windows |
|---|---|---|---|
| API server, web preview, Expo Go on a device | ✅ Node 20+ | ✅ Node 20+ | ✅ Node 20+ |
| Android emulator / local `.apk` build | ✅ Android Studio | ✅ Android Studio | ✅ Android Studio |
| iOS simulator / local iOS build | ✅ Xcode | ❌ not possible | ❌ not possible |
| iOS `.ipa` without a Mac | — | ✅ via `eas build -p ios` (cloud) | ✅ via `eas build -p ios` (cloud) |
| Deploying the API (Docker) | ✅ Docker Desktop | ✅ Docker Engine | ✅ Docker Desktop |

### Common to all platforms

- **Node.js 20+** and npm (ships with Node).
- **Git.**
- For deployment: **Docker** (only needed if you build the API image locally — `fly deploy` can also build it remotely without Docker installed at all).

### Building a native Android app (macOS / Linux / Windows)

Only needed for a signed release `.apk`/`.aab`, or to run on the emulator without Expo Go. Skip this entirely if `npm run dev:mobile` + Expo Go is enough for you.

- **JDK 17** (Temurin is a good pick on every OS). Set `JAVA_HOME` to it.
- **Android SDK**, via Android Studio's SDK Manager or the standalone `cmdline-tools`:
  - Platform-tools
  - `platforms;android-35`
  - A build-tools version matching your Gradle plugin (34.x or 35.x both work)
  - NDK + CMake (pulled in automatically by the React Native Gradle plugin on first build)
- Set `ANDROID_HOME` (or `local.properties` → `sdk.dir`) to the SDK location.
  - **Windows note:** `local.properties` is a Java `.properties` file, where `\` is an escape character — use forward slashes even in a Windows path (`sdk.dir=C:/Users/you/AppData/Local/Android/Sdk`), or the path silently corrupts.
  - **Windows note:** if a build fails with "could not move temporary workspace…to immutable location," Windows Defender's real-time protection is blocking Gradle's atomic file renames. Add exclusions for the project folder, the Android SDK, and `~/.gradle`.

Then:

```bash
cd apps/mobile/android
./gradlew assembleRelease      # or assembleDebug for a debug build
# output: apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

The mobile app reads `EXPO_PUBLIC_API_URL` from `apps/mobile/.env` **at bundle time** — set it to wherever the API actually runs (your LAN IP, or the deployed URL) before building, since a release build can't be pointed at a different API afterward without rebuilding.

For a signed Play Store build or an iOS build, use EAS instead (see Deploying below) — it handles signing and runs on managed cloud builders, so it works identically from any OS.

---

## Deploying

### API — to Fly.io (the included reference config)

The repo ships a `Dockerfile`, `.dockerignore`, and `fly.toml` already set up for this. Fly.io is used here because it gives a persistent volume for SQLite with no separate database to provision, but the same Dockerfile works on any container host (Render, Railway, Google Cloud Run, a plain VPS) — see the alternative note at the end of this section.

1. **Install the Fly CLI** (same tool on every OS):
   ```bash
   # macOS / Linux
   curl -L https://fly.io/install.sh | sh

   # Windows (PowerShell)
   pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
   ```
2. **Sign in and create the app** (pick your own unique name; update `app =` in `fly.toml` to match):
   ```bash
   fly auth login
   fly apps create your-app-name
   ```
3. **Create the persistent volume** SQLite lives on (must be in the same region as `primary_region` in `fly.toml`):
   ```bash
   fly volumes create data --size 1 -a your-app-name -r iad
   ```
4. **Set secrets** — never committed to `fly.toml`:
   ```bash
   fly secrets set \
     GEMINI_API_KEY=your-gemini-key \
     JWT_SECRET=$(openssl rand -hex 32) \
     -a your-app-name
   # optional fallback provider:
   fly secrets set GROQ_API_KEY=your-groq-key -a your-app-name
   ```
5. **Deploy**:
   ```bash
   fly deploy -a your-app-name
   ```
6. **Point the app at it** — set `EXPO_PUBLIC_API_URL=https://your-app-name.fly.dev` in `apps/mobile/.env`, then rebuild (native builds) or restart the dev server (Expo Go).

Useful follow-ups:

```bash
fly logs -a your-app-name              # tail production logs
fly status -a your-app-name            # machine state
fly ssh console -a your-app-name       # shell into the running machine
```

**Cost note:** `fly.toml` sets `auto_stop_machines = "stop"` with `min_machines_running = 0` — the machine shuts down after a few minutes idle and restarts automatically on the next request (visible as a ~7-8 second delay on the first request after a lull, not an error). Set `min_machines_running = 1` in `fly.toml` if you'd rather keep it always warm at a small ongoing cost.

**Postgres instead of SQLite:** for a multi-machine deployment, change `provider` to `"postgresql"` in `apps/api/prisma/schema.prisma`, point `DATABASE_URL` at a Postgres instance, run `prisma migrate deploy`, and drop the `[[mounts]]` block from `fly.toml`.

**Any other Docker host:** the `Dockerfile` builds `apps/api` from the full monorepo context and expects `GEMINI_API_KEY`, `JWT_SECRET`, `DATABASE_URL`, `PORT`, `HOST`, and `CORS_ORIGINS` as environment variables (see `apps/api/.env.example`). Any host that can build a Dockerfile and give you a persistent path (or a Postgres add-on) works the same way.

### Mobile — app stores / signed builds

```bash
npx eas build -p android   # or -p ios
```

EAS runs on Expo's managed cloud builders, so an iOS build works from Windows or Linux without a Mac — you just won't have a local simulator to test on first. An Apple Developer account is required for iOS. For a quick Android `.apk` to sideload without going through EAS or the Play Store, use the local Gradle build described above instead.

---

## Status

Verified working end-to-end: auth and roles, the counsellor approval gate and admin dashboard, connection lifecycle and messaging, Bible lookup/search with cross-language fallback, the safety screen, Chat and Comfort against a live Gemini key (with a tested Groq fallback path), a public Fly.io deployment, and a signed local Android release build installed on a physical device.

Not built, deliberately: payments, scheduling, counsellor ratings, automated credential verification, and push notifications. The reasoning for each is in `.claude/skills/bible-companion/references/counselors.md`.
