# Centurio

Invisible-input budget tracker — speak, type, or scan an expense → AI parses it →
a minimalist "Breathe" dashboard. React Native (Expo) + Supabase + Google Gemini.

## Quick start
```bash
npm install
cp .env.example .env        # fill in your Supabase project values
npm start
```
Full setup against a fresh Supabase project: **[docs/SETUP.md](docs/SETUP.md)**.

## Documentation
All docs live in [`docs/`](docs/README.md): product (PRD), setup, security,
changelog, and Play Store listing. The codebase guide is in
[`CLAUDE.md`](CLAUDE.md).

## Scripts
- `npm start` — Expo dev server
- `npx tsc --noEmit` — typecheck the app (Deno edge functions excluded)
