# Companion API Specifications (v2 RPG)

This document describes the server-facing endpoints that power the Financial Tamagotchi companion. Routes live under `/v1/companion/*` in `apps/llm`.

## 1. Generator Endpoint

**POST** `/v1/companion/generate`

Creates or refreshes a companion persona from a user prompt.

### Request

```json
{
  "userId": "u1",
  "prompt": "A nervous robot that loves crypto"
}
```

### Response

```json
{
  "ok": true,
  "companion": {
    "name": "CryptoBot 9000",
    "archetype": "robot",
    "visuals": { "primaryColor": "#10B981", "accessory": "ledger-nano" },
    "assets": {
      "baby": {
        "idle": "https://.../baby-idle.svg",
        "hungry": null,
        "sleepy": null
      },
      "adult": { "idle": "https://.../adult-idle.svg" },
      "mythic": { "idle": "https://.../mythic-idle.svg" }
    },
    "personality": {
      "tone": "anxious",
      "backstory": "A robot who lost his private keys in a past life.",
      "financialFocus": "investing"
    },
    "initialStats": { "energy": 100, "hunger": 50 }
  }
}
```

### Notes

- Uses Gemini (JSON mode) to expand a short prompt into persona, visuals, backstory, and starter vitals.
- Returns safe defaults when the model is unavailable so the frontend can still render a companion.

## 2. Interactive Chat Endpoint (Context-Aware)

**POST** `/v1/companion/chat`

Produces a short, in-character reply plus an animation cue based on the player action and financial context.

### Request

```json
{
  "message": "Can I buy this $200 jacket?",
  "context": {
    "safeToSpend": 50,
    "memories": [{ "event": "overspent_last_month", "sentiment": "regret" }],
    "personality": {
      "tone": "anxious",
      "backstory": "A robot who lost his private keys in a past life.",
      "financialFocus": "investing"
    },
    "vitals": { "hunger": 40, "cleanliness": 90, "energy": 65 }
  }
}
```

### Response

```json
{
  "ok": true,
  "reply": "Bzzzt! Negative! You promised to save after last month's disaster. Only $50 safe to spend!",
  "animation": "scared",
  "tone": "firm"
}
```

### Notes

- The `animation` string maps to front-end states (e.g., `hungry`, `sleepy`, `excited`).
- The endpoint is latency-capped (default 12s). If the model fails, it returns a canned but context-aware reply with `animation: "idle"`.

## 3. Error Shapes

- `400` — invalid payload (missing required fields, malformed JSON)
- `403` — CORS or auth pre-checks failed
- `429/500/503` — bubbled from Gemini; message contains short description
- All errors return `{ "ok": false, "error": "message" }`

## 4. Environment Dependencies

- `GEMINI_API_KEY` (required)
- `GEMINI_MODEL` (optional, defaults to `gemini-2.0-flash`)
- `CORS_ORIGINS` continues to gate access (see `apps/llm/src/index.ts`).

## 5. Coupling With Frontend

- The frontend calls `/v1/companion/generate` when a user sets the “soul prompt”.
- The tRPC mutation `companionInteract` proxies `/v1/companion/chat` with the latest vitals/xp and returns `reply` + `animation` for the UI.
- Stage assets are URLs (SVG/PNG) per evolution phase; fallback to idle forms when a specific mood variant is missing.

## 6. Change Log

- `2026-01-28` — v2 RPG spec authored for Tamagotchi rollout.
