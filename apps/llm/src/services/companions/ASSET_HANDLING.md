# Asset Pipeline: From Generation to Persistence

## The Flow

1. **LLM Generation (apps/llm)**
   - `/v1/companion/generate` may return external URLs, data URLs, or internal placeholders (e.g., `_assets/chicken_happy.svg`).
   - These are **Source Assets** and should be treated as temporary.

2. **Draft Phase (Frontend)**
   - The wizard renders Source Assets directly for preview (no storage cost yet).
   - Users can tweak name/colors before saving.

3. **Persistence Phase (tRPC `createCompanion`)**
   - For each asset URL:
     1. Detect data URLs vs. external links.
     2. `fetch` → Buffer (or decode base64).
     3. `supabase.storage.from('companions').upload(path, buffer, { upsert: true })` via REST.
     4. Replace the asset URL in JSON with the new `supabase.co/storage/v1/object/public/...` URL.
   - Insert the companion row with sanitized asset URLs.

## Why This Matters

- **Ownership**: External URLs may expire; we host the copies.
- **Performance/CDN**: Supabase Storage + CDN instead of arbitrary hosts.
- **Consistency**: DB only stores URLs we control.

## Constraints

- Bucket: `companions` (public).
- Path convention: `{userId}/{companionId}/{stage}-{mood}.(svg|png|gif|webp)`.
- If any upload fails, abort the DB insert and surface an error to the user.
- Saving may take a few seconds—surface a clear "Awakening your companion..." loading state in the UI.

## Types to Follow

- Assets map aligns with `CompanionAssets` and `CompanionAssetsStage` in `apps/web-client/src/db/schema/companion.ts`.
- tRPC inputs should mirror the shared types in `apps/web-client/src/services/ai-agent/types`.
