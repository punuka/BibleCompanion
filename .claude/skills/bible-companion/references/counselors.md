# Counsellors: registration, approval, connection

## Lifecycle

```
User registers ──► POST /v1/counselors/apply ──► CounselorProfile { status: PENDING }
                                                          │
                            admin reviews ────────────────┤
                                                          ├─► APPROVED  → appears in directory, User.role = COUNSELOR
                                                          └─► REJECTED  → invisible; may re-apply after edits

User browses  ──► GET /v1/counselors?language=&specialty=   (APPROVED only)
User requests ──► POST /v1/counselors/:id/connect            → Connection { status: REQUESTED }
Counsellor    ──► PATCH /v1/connections/:id { status }       → ACCEPTED | DECLINED
Either side   ──► POST /v1/connections/:id/messages          (ACCEPTED only)
Either side   ──► PATCH /v1/connections/:id { status: CLOSED }
```

## Application payload

```ts
{
  headline: string          // "Pastoral counsellor, 12 years, grief and bereavement"
  bio: string               // 100–2000 chars
  languages: string[]       // codes from the shared registry
  specialties: string[]     // from SPECIALTIES in packages/shared
  credentials: string       // free text: ordination, licence numbers, training
  organization?: string
  yearsExperience: number
  contactEmail: string
}
```

Applying sets `status: PENDING` and does **not** change `User.role`. The role flips to `COUNSELOR` only on approval, and back to `USER` on rejection or suspension. Two places must agree on this: `routes/counselors.ts` (apply) and `routes/admin.ts` (decision). If they drift, you get counsellors with counsellor-only route access who are not in the directory, or vice versa.

## Approval gate — the invariant

Exactly one query serves the public directory, and it is in `routes/counselors.ts`:

```ts
where: { status: "APPROVED", ...filters }
```

Every test in `test/counselors.test.ts` exists to defend this. If you add a new listing endpoint — "featured counsellors", "recently active", search — it must reuse `listApproved()` from `services/counselors.ts` rather than writing its own `prisma.counselorProfile.findMany`. That indirection is the whole point.

Admin decision endpoint requires `role === 'ADMIN'` via `app.requireRole('ADMIN')`. There is no self-approval path, and `POST /counselors/apply` cannot set `status`; the field is stripped server-side even if the client sends it.

## Messaging

Connection messages are plain text between two known parties — no model involvement, no scripture tools, no streaming. Keep it that way. The value of the counsellor feature is that it is *not* the AI, and quietly summarising or suggesting replies would undermine it.

Authorisation on every message route: the requester must be either `connection.userId` or `connection.counselorProfile.userId`, and `connection.status` must be `ACCEPTED`. Both checks, every time — a REQUESTED connection is not yet a channel.

## What is deliberately not built

- No payments or scheduling. If added, keep them out of the connection message table.
- No public counsellor ratings. Ratings on spiritual care invite abuse and gaming; if the product needs them, design the moderation first.
- No automated credential verification. `credentials` is free text reviewed by a human admin. Do not add a flow that auto-approves on a regex match against it.
- No counsellor visibility into the user's AI chat history. The connection is a fresh context. If you add sharing, it must be an explicit per-conversation user action.
