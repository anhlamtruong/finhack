# AI Agent Service

## Overview

Provides AI assistant UI entry points, companion UI, and server procedures
for AI-driven summaries and companion interactions.

## Architecture

- `components/`: companion UI, HUD, and onboarding.
- `hooks/`: local companion engine + UI state helpers.
- `procedures/`: server calls for LLM summaries + companion CRUD/interaction.
- `provider/`: active companion + page context.
- `utils/`: page-context mapper for LLM enrichment.
- `types/`: shared types for companion data and engine results.

## User flow

### Companion user flow (web-client)

1. `CompanionProvider` loads companions with `getCompanions` and picks the active one.
2. UI components (e.g. welcome card, floating HUD) read `useActiveCompanion`.
3. The local engine (`useCompanionEngine`) derives mood, stage, and vitals for display.
4. If the user clicks Analyze, `companionInteract` sends the action + page context to the LLM.
5. The LLM response returns a short reply + animation cue for the HUD bubble.

### Creation flow

1. The creation wizard calls `generateDraft` to get a draft persona + assets.
2. Draft assets are uploaded during `createCompanion` and stored in Supabase.
3. Queries are invalidated and the new companion becomes selectable.
