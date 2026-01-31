# LLM Requirements (Financial Tamagotchi)

## Overview

- Purpose: Power the "Financial Tamagotchi" companion with persona generation, context-aware chat, and vitals-aware responses.
- Services: Node/Express LLM service (apps/llm) + Next.js frontend (apps/web-client) via tRPC.

## Functional Requirements

- Persona generation: Expand user prompt into companion archetype, visuals, backstory, and initial vitals.
- Context-aware chat: Accept financial context (safe-to-spend, memories, vitals) and return short reply + animation cue.
- Safety: Always return valid JSON; provide graceful fallbacks on model errors/timeouts.
- Latency: Target < 12s per LLM call; hard-cap timeouts and retry transient Gemini errors.
- Asset URLs: Accept/generate per-stage assets (baby/adult/mythic, mood variants). Default to idle assets when specific moods missing.

## API Contract (LLM service)

- POST `/v1/companion/generate`: input { userId, prompt }; output companion { name, archetype, visuals, assets, personality, initialStats }.
- POST `/v1/companion/chat`: input { message, context { safeToSpend, memories[], personality, vitals } }; output { ok, reply, animation, tone }.
- Health: `/v1/companion/ping`, `/v1/health`, `/v1/_meta` expose router load status.

## Data Model Alignment

- Frontend Drizzle tables: companions, companion_memories, companion_events store vitals/xp/personality/assets ([apps/web-client/src/db/schema/companion.ts](../web-client/src/db/schema/companion.ts)).
- Vitals mapping: hunger ↔ savings deficit, cleanliness ↔ uncategorized count, energy ↔ inactivity decay.
- XP: login (+10), categorize (+5), budgetWin (+100), pet/feed/clean small boosts.

## Non-Functional Requirements

- Availability: APIs should return fallbacks if Gemini unavailable (HTTP 200 with canned reply).
- Observability: Log router version and load source; include timing logs per request.
- CORS: Restrict to configured origins; reject others with 403.
- Input validation: Coerce/guard missing strings/numbers; cap payload size (JSON body limit 2mb from Express base).

## Environment Variables

- Required: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (for other routes), `CORS_ORIGINS`.
- Optional: `GEMINI_MODEL` (default `gemini-2.0-flash`), `GEMINI_HARD_TIMEOUT_MS`, `GEMINI_MAX_RETRIES`, `PORT`.

## Deployment Notes

- Service entry: [apps/llm/src/index.ts](src/index.ts) mounts routers; companion router dynamically loaded.
- Artifacts: No DB migrations here; assets served from `/assets` with generated output stored under `apps/llm/assets/generated`.

## Error Handling

- Standard shape: `{ ok: false, error: "message" }` for 4xx/5xx.
- Timeouts: Return 504-equivalent when exceeding per-call deadline; chat route falls back to canned response with `ok: true`.

## Security & Compliance

- Never return secrets; redact URIs in diagnostics.
- CORS enforced; rate limiting can be added at gateway (not included here).

---

# User Flow & File Wiring

## High-Level Flow

1. User opens dashboard → frontend fetches AI summary and companion state (tRPC).
2. Companion UI renders vitals/XP and avatar; user interacts (feed/clean/pet).
3. tRPC mutation `companionInteract` updates Drizzle tables, adjusts vitals/XP, then calls LLM chat for a reply/animation.
4. LLM service `/v1/companion/chat` returns JSON → frontend updates UI with optimistic XP and mood visuals.
5. Persona setup uses `/v1/companion/generate` to create the "soul" from prompt; stored in companion assets/personality JSONB.

## Key Frontend Pieces (apps/web-client)

- Schema: companions/events/memories in [src/db/schema/companion.ts](../web-client/src/db/schema/companion.ts) exported via [src/db/schema/index.ts](../web-client/src/db/schema/index.ts).
- Engine hook: Vitals/mood/xp logic + optimistic updates in [src/services/ai-agent/hooks/use-companion-engine.ts](../web-client/src/services/ai-agent/hooks/use-companion-engine.ts).
- Types: Shared companion types in [src/services/ai-agent/types/companion.ts](../web-client/src/services/ai-agent/types/companion.ts).
- UI: Avatar base + particles and vitals renderer in [src/services/ai-agent/components/companion-renderer.tsx](../web-client/src/services/ai-agent/components/companion-renderer.tsx) and particle components under `components/avatars/`.
- TRPC: Interaction mutation in [src/services/ai-agent/procedures/interact.ts](../web-client/src/services/ai-agent/procedures/interact.ts), exported through router [src/server/routers/app.ts](../web-client/src/server/routers/app.ts).

## Key Backend Pieces (apps/llm)

- Router mount: [src/index.ts](src/index.ts) dynamically loads companion router and exposes meta status.
- Companion routes: [src/routes/companion.ts](src/routes/companion.ts) implement `/generate` and `/chat` with Gemini + fallbacks.
- Gemini helper: Resilient JSON/text calling helpers in [src/services/gemini.ts](src/services/gemini.ts) with retries, timeouts, and fence-stripping.
- API spec doc: [COMPANION_API_SPECS.md](COMPANION_API_SPECS.md) for backend consumers.

## Data & Control Path

- Frontend action → tRPC `companionInteract` → Drizzle update (companions + companion_events) → Axios call to `LLM_URL/v1/companion/chat` → returns reply/animation → UI updates mood/particles.
- Persona creation → Frontend (future flow) posts to `/v1/companion/generate` → saves assets/personality JSONB into companions table.

## Migration/Setup Checklist

- Run `cd apps/web-client && npm run db:generate` after adding schema to create migrations.
- Set `LLM_URL` in web-client env and `GEMINI_API_KEY` in llm service.
- Confirm CORS origins include the deployed web-client URL.
