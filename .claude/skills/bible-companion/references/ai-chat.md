# AI chat, prompts, and safety

All model code lives in `apps/api/src/services/gemini/`.

| File | Role |
|---|---|
| `client.ts` | the single `GoogleGenAI` instance and model constants |
| `prompts.ts` | system prompt builders, per language and per surface |
| `tools.ts` | `bible_lookup` / `bible_search` function declarations and executors |
| `chat.ts` | the streaming chat loop |
| `comfort.ts` | structured comfort response |

## Model configuration

```ts
model: "gemini-2.5-flash"        // chat and comfort
model: "gemini-2.5-flash-lite"   // titleConversation() only
```

Why these:

- **Flash, not Pro.** This runs on the free tier (`aistudio.google.com` API keys), and Flash is the strongest model that stays within the free-tier rate limits while still supporting function calling and JSON schema output in the same conversation.
- **Streaming for chat.** Replies are long-ish and a pastoral answer that appears all at once after several seconds feels worse than one that unfolds. Streaming also removes HTTP-timeout risk.
- **`gemini-2.5-flash-lite`** is used only in `titleConversation()` — a short pass to name a thread. It never touches user-facing pastoral content.

## The Bible tools

Two tools, both server-executed against Prisma:

```ts
bible_lookup  { ref: "John 14:27" }
bible_search  { query: string, theme?: string, limit?: number }
```

Declared as Gemini `FunctionDeclaration`s in `tools.ts` (the `Type` enum, not a plain JSON Schema — that's only for `responseJsonSchema`, see below). The system prompt says, in substance: *you may only quote scripture returned by these tools; if a lookup returns nothing, say you could not find that passage rather than reciting it from memory.* This is the anti-fabrication guarantee — a model this capable "knows" the Bible, and that is precisely the problem, because it also confabulates references under pressure.

`chat.ts` runs a manual streaming loop (`generateContentStream` → collect text deltas + `functionCalls` per chunk → execute tools → push a `model` turn then a `user` turn with `functionResponse` parts → repeat) rather than the SDK's `Chat` convenience class, because the HTTP client needs per-token deltas relayed to SSE while the scripture tools still run server-side. Cap iterations at 5.

Executed tool results are also accumulated into a `citations` array and emitted as `citation` SSE events, so the mobile app can render tappable verse chips independently of the prose.

## System prompt structure

`prompts.ts` is provider-agnostic — plain strings, passed as `config.systemInstruction`. `buildChatSystemPrompt(language)` / `buildComfortSystemPrompt(language)` assemble, in order:

1. **Identity** — a companion for reading and reflecting on the Bible; warm, unhurried, not performatively pious.
2. **Language** — respond entirely in the target language, including verse text, using the translation named for that language.
3. **Scripture discipline** — the tool rule above.
4. **Pastoral posture** — meet the feeling before the theology; ask before assuming denomination; do not moralise; do not diagnose.
5. **Hard boundaries** — no medical, legal, or financial specifics; no claims about the user's salvation or God's specific intent for them; redirect to a qualified human where appropriate.
6. **Human counsellors** — mention that approved counsellors are available in-app when the user's need is sustained, relational, or beyond a chat.
7. **Length** — short by default; the user's grief does not need an essay.

Clause 7 matters more than it looks. An unprompted six-paragraph answer to "I'm sad today" reads as a lecture.

## Safety screening

`src/services/safety.ts` runs **before** the model, on every inbound chat message and comfort submission.

```ts
screen(text, language) -> { level: "none" | "concern" | "crisis", resources: Resource[] }
```

It is a keyword/pattern screen across the supported languages — deliberately blunt and deliberately biased toward false positives. On `crisis`:

1. A `safety` SSE event fires immediately with region-appropriate hotlines from `data/crisis-resources.json`.
2. The mobile app renders that block pinned above the reply, non-dismissible for that turn.
3. The model still responds, with a crisis-mode addendum appended to the system prompt for that turn only, instructing it to stay present, avoid problem-solving, and encourage contacting the listed resources or a counsellor.

Do not route the screening decision through the model. A model can be talked out of a refusal; a regex cannot. The model's job here is the response, not the triage.

## Structured comfort responses

`POST /v1/comfort` uses structured JSON output, not free text — but Gemini's function calling and controlled JSON output are unreliable when combined in a single request, so `composeComfort` runs in two phases:

1. **Gather** — `generateContent` with `tools: [{ functionDeclarations: BIBLE_TOOLS }]`, freeform, looped up to 4 iterations until the model stops calling tools.
2. **Compose** — one final `generateContent` call, no tools, with:
   ```ts
   config: {
     responseMimeType: "application/json",
     responseJsonSchema: { /* acknowledgement, verses[], reflection, prayer, followUp[] */ },
   }
   ```
   `responseJsonSchema` takes a plain JSON Schema object (unlike the tool declarations, which use Gemini's `Type` enum) — that's why `comfort.ts`'s `SCHEMA` constant looks like ordinary JSON Schema.

`verses[]` entries must be refs the model obtained from a tool call in phase 1; `comfort.ts` validates each returned ref against the store and drops any that do not resolve, logging a warning. A dropped verse is a prompt-quality signal worth investigating, not a normal condition.

## Adding a surface

If you add a model-backed surface, decide these four things explicitly and write them into `prompts.ts` rather than inline at the call site: language handling, whether it streams, whether it needs structured output (and therefore the two-phase gather/compose split), and whether scripture may appear (and therefore whether the tools are attached). Surfaces that quote scripture without the tools are the main way this app can regress into fabricating verses.

## Voice input and read-aloud

Chat and comfort both support voice in and audio out — no new API keys, both free:

- **Read-aloud (TTS)**: `expo-speech`, on-device, no network call. `apps/mobile/src/audio/tts.ts` maps a language code to a BCP-47 locale for a better voice match. Wired in via the shared `SpeakButton` component (`apps/mobile/src/components/ui.tsx`) on assistant chat bubbles, the comfort response, and `VerseCard`.
- **Voice input (STT)**: recorded client-side with `expo-av` (`apps/mobile/src/audio/recorder.ts`, m4a/AAC via `HIGH_QUALITY` preset), then transcribed server-side by `POST /v1/speech/transcribe` (`apps/api/src/routes/speech.ts` → `services/gemini/speech.ts`). This is its own surface per the rule above: no streaming, no structured output, no bible tools — it must never quote scripture, only transcribe. It reuses `GEMINI_API_KEY`, so no separate speech service or key to configure. Confirmed against the live API that Gemini's audio pipeline sniffs the container regardless of the declared mimeType; `audio/aac` is used since it's one of Gemini's documented supported audio types. The transcribed text lands in the composer for the user to review/send — it does not bypass the safety screen, which still runs on the actual chat/comfort submission.
