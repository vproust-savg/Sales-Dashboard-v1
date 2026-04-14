# Vite Stale Compiled JS Artifacts

## The Problem

Vite resolves `.js` before `.tsx`. If compiled `.js` files exist alongside `.tsx` sources in
`client/src/` (from a prior `tsc` run with wrong `outDir`), all edits to `.tsx` sources are
invisible in the browser — Vite loads the old `.js` copies instead. HMR appears to fire but
nothing changes. Browser DevTools will show `.js` file paths instead of `.tsx` in the module
graph.

## Symptoms

- Tailwind class changes on a component have no visible effect
- `className` from a stale version appears in browser, not the current source
- Browser source panel shows `App.js`, `HeroRevenueCard.js`, etc. instead of `.tsx`

## How to Detect

```bash
find client/src -name "*.js" | head -10
```

If any results appear (excluding `*.config.js` or Vite-owned files), those are stale artifacts.

## Fix: Two-Step Cleanup

**Step 1 — Delete the stale `.js` files:**
```bash
find client/src -name "*.js" -not -path "*/node_modules/*" -delete
```

**Step 2 — Clear Vite's module cache** (required — otherwise Vite serves 404s for the deleted
files, causing a blank screen):
```bash
rm -rf client/node_modules/.vite
```

Then restart the Vite dev server.

## Root Cause

A previous `tsc` run had the wrong `outDir` in `tsconfig.json`, compiling sources into
`client/src/` instead of `client/dist/`. The correct setting is `"outDir": "../dist"` (server)
or handled entirely by Vite (client — the client should never invoke `tsc` directly to compile).

## Discovered

2026-04-14 — ~80 stale `.js` files in `client/src/` caused an entire session of edits to be
invisible until discovered via browser DevTools source panel inspection.
