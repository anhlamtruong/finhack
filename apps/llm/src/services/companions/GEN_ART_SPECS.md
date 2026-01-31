# Generative Art Pipeline Specifications

## 1. Static Asset Serving
The LLM service acts as a temporary CDN for draft assets.
- **Base URL:** `http://localhost:8080/assets` (or `LLM_URL`/`LLM_PUBLIC_URL`)
- **Structure:** `/companions/{userId}/{draftId}/{filename}`
- **Storage Root:** `apps/llm/public/assets`

## 2. Generation Strategy
We use **Google Vertex AI** (Veo or Imagen) to generate assets when configured.

### Prompts
- **Style Enforcer:** "pixel art, 16-bit, flat style, white background, sprite sheet"
- **Subject:** Derived from user prompt + JSON visual config.

### Performance
- **Timeout:** 15s per asset (draft stage).
- **Fallback:** If video generation fails or Vertex is not configured, generate a static pixel-art GIF placeholder.

## 3. Draft Assets
`POST /v1/companion/generate`
- Generates JSON config first.
- Generates **Baby, Adult, Mythic** stage assets (idle, happy, sleepy, hungry) — 12 GIFs total.
- Writes to `public/assets/companions/{userId}/{draftId}/` and returns absolute URLs.

## 4. Cleanup Protocol
Draft assets are ephemeral.
- Frontend MUST call `POST /v1/companion/cleanup` after persistence.
- Cleanup accepts a relative path like `companions/{userId}/{draftId}` and deletes it.
- Future: scheduled cleanup for folders older than 24h.
