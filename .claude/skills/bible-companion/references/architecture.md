# Architecture

## Shape

```
Expo app (iOS / Android / web)
  │  HTTPS + JWT bearer
  ▼
Fastify API  ──► Prisma ──► SQLite (dev) / Postgres (prod)
  │
  ├─► Gemini API (streamed SSE relayed to the client)
  └─► Bible store (Prisma tables, seeded from JSON)
```

The mobile app never holds the Gemini key. Every model call originates in `apps/api`.

## Data model (`apps/api/prisma/schema.prisma`)

| Model | Purpose |
|---|---|
| `User` | account, `role` (USER/COUNSELOR/ADMIN), `language`, `displayName` |
| `Conversation` | a chat thread, owns `language` at creation time |
| `Message` | `role` (user/assistant), `content`, optional `citations` JSON |
| `ComfortSession` | one situation → one structured response, kept for history |
| `Verse` | `ref`, `book`, `chapter`, `verse`, `text`, `translation`, `language`, `themes` |
| `CounselorProfile` | 1:1 with User. `status` PENDING/APPROVED/REJECTED/SUSPENDED, `languages`, `specialties`, `credentials`, `bio` |
| `Connection` | user ↔ counsellor. `status` REQUESTED/ACCEPTED/DECLINED/CLOSED |
| `ConnectionMessage` | messages inside an accepted connection |

`languages`, `specialties`, `themes`, and `citations` are stored as JSON strings so the schema works on SQLite and Postgres unchanged. Read/write them through the helpers in `src/lib/json.ts`; do not `JSON.parse` inline at call sites.

## Auth

- `POST /v1/auth/register` and `/login` return a JWT (`sub`, `role`, 30d).
- `app.authenticate` (in `plugins/auth.ts`) is a `preHandler` that verifies the bearer token and populates `req.user`.
- `app.requireRole('ADMIN')` composes on top of it.
- Passwords hashed with bcrypt, cost 12.

The very first registered account is promoted to `ADMIN` automatically so a fresh install has someone who can approve counsellors. This is in `routes/auth.ts` — keep it, or a fresh deploy has no admin.

## API contract

Base path `/v1`. All authenticated unless noted.

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | public |
| POST | `/auth/login` | public |
| GET | `/auth/me` | |
| PATCH | `/auth/me` | change `language`, `displayName` |
| GET | `/languages` | public; the language registry |
| GET | `/situations` | public; comfort categories |
| GET | `/bible/verse?ref=` | |
| GET | `/bible/search?q=&theme=&language=&limit=` | |
| GET | `/chat/conversations` | |
| POST | `/chat/conversations` | |
| GET | `/chat/conversations/:id` | thread + messages |
| DELETE | `/chat/conversations/:id` | |
| POST | `/chat/conversations/:id/messages` | **SSE stream** |
| POST | `/comfort` | structured; `{ situation, freeText }` |
| GET | `/comfort` | history |
| POST | `/speech/transcribe` | `{ audio: base64, mimeType, language? }` → `{ text }`; voice input for chat/comfort composers |
| POST | `/counselors/apply` | become a counsellor (→ PENDING) |
| GET | `/counselors` | directory, APPROVED only |
| GET | `/counselors/:id` | |
| POST | `/counselors/:id/connect` | creates a REQUESTED connection |
| GET | `/connections` | as user or counsellor |
| PATCH | `/connections/:id` | counsellor accepts/declines |
| GET | `/connections/:id/messages` | |
| POST | `/connections/:id/messages` | |
| GET | `/admin/counselors?status=` | ADMIN |
| POST | `/admin/counselors/:id/decision` | ADMIN; `{ status, note }` |

## SSE contract for chat

`POST /v1/chat/conversations/:id/messages` responds `text/event-stream`. Event names are meaningful; the client switches on them.

```
event: meta      data: {"messageId":"...","language":"en"}
event: safety    data: {"level":"crisis","resources":[...]}      // only when triggered
event: delta     data: {"text":"Peace be"}                        // repeated
event: citation  data: {"ref":"John 14:27","text":"...","translation":"WEB"}
event: done      data: {"messageId":"...","citations":[...]}
event: chatError data: {"message":"..."}
```

The client must treat `delta` as append-only and must not assume `citation` events arrive before the text that references them.

The error event is deliberately named `chatError`, not `error` — the SSE spec (and libraries like `react-native-sse`) reserve a plain `error` event for transport-level failures with a different shape (`message` but no `data`), so a same-named application event would have its payload silently dropped by client-side EventSource implementations.

## Environments

`apps/api/.env`:

```
GEMINI_API_KEY=AIza...
DATABASE_URL="file:./dev.db"     # or postgresql://... in prod
JWT_SECRET=<32+ chars>
PORT=8787
HOST=0.0.0.0                     # 0.0.0.0 so emulators/devices can reach it
```

`apps/mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://10.0.2.2:8787   # see references/emulators.md
```

Switching to Postgres is a two-line change: `provider = "postgresql"` in `schema.prisma` and the `DATABASE_URL`. No query code changes, because the JSON-as-string helpers avoid provider-specific column types.
