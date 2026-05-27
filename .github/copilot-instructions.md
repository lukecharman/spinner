# Copilot / Agent instructions for the Spinner repo

This repo is a small Vite + React + TypeScript single-page app deployed to
GitHub Pages at https://lukecharman.github.io/spinner/ (base path `/spinner/`).
Data sync uses Firebase (config in [src/firebase.ts](src/firebase.ts)).

When working on this repo, follow these conventions.

## Project layout
- Entry: [src/main.tsx](src/main.tsx) → [src/App.tsx](src/App.tsx)
- Feature components live in [src/components/](src/components/)
- Hooks (Firebase-backed state) in [src/hooks/](src/hooks/)
- Global styles in [src/App.css](src/App.css) and [src/index.css](src/index.css)
- Vite base path is `/spinner/` — never hardcode absolute URLs that assume root

## Commands
- Install: `npm ci`
- Dev server: `npm run dev` (serves at `/spinner/`)
- Lint: `npm run lint` — must pass before committing
- Type-check + build: `npm run build`
- Local manual deploy (rarely needed; CI handles it): `npm run deploy`

Always run `npm run lint` and `npm run build` before opening a PR. If either
fails, fix the cause — do not bypass with `--no-verify` or by disabling rules.

## Coding conventions
- TypeScript strict mode is on. Prefer explicit types on exported APIs; let
  inference handle locals.
- React function components only. Hooks at top level. Keep components focused
  and colocate state with the component that owns it.
- Don't introduce new dependencies unless clearly necessary. Prefer native
  browser APIs (e.g. `URLSearchParams`, `crypto.subtle`) over libraries.
- Match existing formatting (2-space indent, single quotes, semicolons).
- Avoid adding comments to code you didn't change. Don't add docstrings or
  type annotations to unrelated code while making a fix.

## Firebase / rooms
- A "room" is identified by a 16-char hex `roomId` derived from
  `SHA-256(roomCode.trim().toLowerCase())` (see `hashRoomCode` in
  [src/App.tsx](src/App.tsx) and the duplicate in
  [src/components/TeamLogin.tsx](src/components/TeamLogin.tsx)).
- Direct-link to a room via `?room=<code>` query param.
- Never log or persist the raw Firebase config beyond what's already in
  [src/firebase.ts](src/firebase.ts).

## Deploy
- Pushes to `main` trigger
  [.github/workflows/deploy.yml](.github/workflows/deploy.yml), which builds
  and publishes `dist/` to the `gh-pages` branch.
- A merged PR fixing an issue will therefore deploy automatically — no manual
  step required. You can also run the workflow on demand via
  `workflow_dispatch`.

## PR checklist for the agent
1. Reproduce / understand the issue.
2. Make the minimal change required.
3. Run `npm run lint` and `npm run build` locally (in CI for the agent).
4. Open a PR describing the change and linking the issue with `Fixes #N`.
5. Once merged to `main`, the deploy workflow ships it.
