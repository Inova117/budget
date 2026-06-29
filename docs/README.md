# Denario — Documentation

Invisible-input budget tracker: speak, type, or scan an expense → AI parses it →
minimalist "Breathe" dashboard. React Native (Expo) + Supabase + Google Gemini.

## Index
- [PRD.md](PRD.md) — product requirements & vision.
- [SETUP.md](SETUP.md) — stand up Denario on a fresh Supabase project (schema,
  functions, secrets, env, build).
- [SECURITY.md](SECURITY.md) — key protection, JWT validation, RLS, data handling.
- [CHANGELOG.md](CHANGELOG.md) — V2 changes.
- [PLAY_STORE.md](PLAY_STORE.md) — store listing copy + submission checklist.
- [privacy-policy.en.md](privacy-policy.en.md) / [privacy-policy.es.md](privacy-policy.es.md)
  — privacy policies (EN/ES).

## Architecture
The codebase guide lives at the repo root in [`../CLAUDE.md`](../CLAUDE.md)
(loaded automatically by tooling). It documents the state hub, the single
Supabase client, the data-model contract, and the edge functions.
