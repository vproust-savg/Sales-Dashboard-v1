# Priority ERP — Sales Interactive Dashboard

## What is this project?

A master-detail sales dashboard that visualizes Priority ERP sales data. Left panel shows a filterable, searchable entity list (customers, zones, vendors, brands, product types, products). Right panel shows KPIs, charts, and detailed tables for the selected entity.

Embedded in Airtable via Omni. Deployed on Railway via Dockerfile.

**Data flow:** Priority oData API → Express backend → Upstash Redis cache → React frontend
**Language:** TypeScript strict mode throughout. Zero plain JavaScript.
**Maintained by:** Claude Code (sole developer). Reviewed by Codex, Grok, Deepseek, Gemini, Minimax.

## Safety Constraints

- **Priority ERP is READ-ONLY.** The dashboard must NEVER write data to Priority. No POST, PUT, PATCH, DELETE. This is non-negotiable.
- **Test customer:** `C7826` — use for all validation and testing.
- **No secrets in source code.** Priority credentials and Redis tokens live in `.env` only.

## How to Work

### Before implementing
- State your assumptions and understanding of the task before writing code.
- If a request is ambiguous, ask — do not guess intent.
- When multiple approaches exist, present tradeoffs and recommend one.
- Define what "done" looks like: what should work, what commands verify it.

### While implementing
- Make the smallest change that solves the problem. Do not refactor adjacent code.
- Match existing patterns exactly. Read a similar file before creating a new one.
- One concern per commit. Do not bundle unrelated changes.

### Before claiming done
- Run pre-deploy verification (see Commands section).
- Test the specific behavior you changed — not just "it compiles."
- If you hit a bug, use `/systematic-debugging`. Do not guess at fixes.
- Show evidence: paste command output that proves the change works.

### When stuck
- Read `learnings/` — the answer may already be documented.
- Check the sister project: `/Users/victorproust/Documents/Work/SG Interface/Priority Reports/`
- Priority API issues → read `tools/Priority ERP March 30.xml` for entity/field names.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Express + TypeScript |
| Frontend | React 19 + Vite + Tailwind CSS v4 + Framer Motion |
| Data Fetching | TanStack Query v5 |
| Validation | Zod |
| Cache | Upstash Redis (years of sales history cached server-side) |
| Deploy | GitHub → Railway auto-deploy |

## Commands

| Command | Where | Description |
|---------|-------|-------------|
| `npm run dev` | `server/` | Start Express on port 3001 |
| `npm run dev` | `client/` | Start Vite on port 5173 (proxies API to 3001) |
| `npm test` | `server/` | Run Vitest |

**Development:** Run both `npm run dev` commands in separate terminals. Vite proxies `/api` to Express.

**Deploy:** Push to `main` on GitHub → Railway auto-deploys via Dockerfile (multi-stage build). Express serves the React client in production.

**Airtable embed:** Embedded via Omni block (Interface page). Test production changes at the Airtable page — iframe constraints can surface different behavior.

**Pre-deploy verification (all must pass):**
```bash
cd client && npx tsc -b --noEmit   # Client TS build
cd ../server && npx tsc --noEmit   # Server TS build
cd ../server && npx vitest run     # Server tests (63 total, 61 pass — 2 formatDays tests have test-code mismatch)
cd ../client && npx vite build     # Client bundle (must be <500KB gzip)
```
All must pass — any TypeScript error kills the Railway Docker build.
Also verify: no `any` types (`grep -rn ": any\|as any" server/src/ client/src/`), no files >200 lines, no secrets in source.

## Project Structure

| Directory | Purpose |
|-----------|---------|
| `server/src/` | Express API: routes, services (Priority client, aggregation), cache (Redis), middleware |
| `client/src/` | React app: components (left-panel, right-panel, shared), hooks, layouts, styles, utils |
| `shared/` | TypeScript types + utilities shared between server and client |
| `docs/` | Specs, plans, evals, decisions (ADRs), runbooks |
| `learnings/` | Development discoveries and lessons learned (ALWAYS UPDATE) |
| `tools/` | Reference files: Priority XML metadata, useful links (READ ONLY) |

**Infrastructure:** `Dockerfile` (multi-stage build), `railway.json` (DO NOT DELETE), `.dockerignore`

**Parallel session rules:** Plan 0 creates `shared/` first. Backend session writes only to `server/`. Frontend session writes only to `client/`. Neither modifies `shared/` or `CLAUDE.md`.

## Learnings (MANDATORY)

**Always update `learnings/` during development.** When you discover something non-obvious — an API quirk, a library gotcha, a pattern that works, a debugging insight — write it down immediately as a markdown file in `learnings/`. This is how knowledge survives across sessions.

Examples of what to capture:
- Priority ERP API behaviors not documented in the XML metadata
- Redis caching patterns that worked (or didn't)
- Tailwind v4 / React 19 quirks encountered during development
- OData query patterns that avoid timeouts or rate limits
- Docker/Railway deployment gotchas
- Performance optimizations discovered through profiling

**Format:** One file per topic, named descriptively (e.g., `priority-api-pagination-gotcha.md`, `redis-key-naming-pattern.md`). Keep each file short and actionable.

## Dashboard Architecture

Master-detail layout: fixed left panel (entity list) + flexible right panel (KPIs, charts, tabs).
6 dimensions share the same template via `groupBy` parameter. Multi-select aggregates data.

**Full spec:** `docs/specs/2026-03-29-sales-dashboard-design.md` | **Mockup:** `docs/specs/dashboard-mockup-v5-reference.png`

## LLM-Optimized Code Rules (MANDATORY)

This code is maintained exclusively by LLMs. Every decision optimizes for AI readability.

1. **Intent block** at top of every file: `FILE`, `PURPOSE`, `USED BY`, `EXPORTS`
2. **WHY comments** on non-obvious decisions. Never comment WHAT (LLMs can read code).
3. **Every file under 200 lines.** Split if approaching 250.
4. **Import order:** React/libraries → hooks → components → utils → types
5. **Identical patterns** for identical things — all routes, all components, all hooks.
6. **Descriptive greppable names:** `formatCurrencyValue()` not `fmt()`
7. **No clever abstractions.** Explicit > implicit. Boring > clever. Readable > compact.

## Design System

All tokens (colors, spacing, radii, shadows, fonts) defined in `client/src/styles/index.css`.
Use Tailwind token classes (`text-gold-primary`, `bg-card`) — never hardcode hex values.

## Priority ERP API Reference

- **URL pattern:** `https://us.priority-connect.online/odata/Priority/tab{CODE}.ini/{COMPANY}/`
- **Auth:** HTTP Basic Auth (base64 encoded username:password)
- **Rate limits:** 100 calls/minute, 15 queued max, 3-minute timeout per request
- **Pagination:** `$top` + `$skip` params. Always paginate — large entities timeout without it.
- **MAXAPILINES:** Currently set to 50,000. Controls max rows per API response.
- **Optimal pattern:** Use `$expand=SUBFORM($select=field1,field2)` with nested `$select` to avoid N+1 subform calls.
- **Header:** Always include `Prefer: odata.maxpagesize=49900`
- **Header:** Always include `IEEE754Compatible: true`
- **XML metadata:** `tools/Priority ERP March 30.xml` contains entity names and field definitions
- **Existing reference:** The sync project at `/Users/victorproust/Documents/Work/Priority/Airtable_Priority_N8N_v1/` uses the same Priority API.

## Common Mistakes (avoid these)

**Priority API:**
- Interpolating user input directly into OData `$filter` queries — validate with Zod
- `$expand` on DOCUMENTS_P is BROKEN — use two-step `enrichRows` pattern instead
- URL encoding trap: do NOT use `searchParams.set()` for `$expand` — it double-encodes `$select`. Build the URL string with raw concatenation.
- Priority has TWO error response formats: JSON `{ "odata.error": { "message": { "value": "..." } } }` and plain text. Parse both. The key `"odata.error"` has a DOT in the name — use `obj['odata.error']` (bracket notation), NOT `obj.error`. The message is nested: `.message.value`, not `.message` directly.
- Custom fields on ORDERITEMS follow the `Y_XXXX_5_ESH` naming pattern (e.g., `Y_2K28_5_ESH` for vendor code)

**Tailwind + CSS:**
- v4 uses CSS-native `@theme` in `index.css`, NOT `tailwind.config.js`
- Hardcoding Tailwind colors instead of the design token palette
- Dynamic Tailwind classes like `` col-span-${n} `` — use a mapping object
- CSS Grid equal-height trap: `items-start` on a grid prevents columns from stretching to the same height. Remove it to use the default `stretch`. To make a card fill its grid cell, use `h-full flex-col justify-between` — extra height becomes spacing between sections. Do NOT use ResizeObserver + `flex-1` to grow a chart inside a grid cell — flex-1 has no height constraint in a grid cell and will expand infinitely.

**TypeScript + Docker + Railway:**
- Leaving unused variables — `noUnusedLocals: true` means `tsc -b` fails, killing the Railway Docker build
- Deleting `railway.json` — Railway needs this file for Dockerfile builder
- Never commit compiled `.js` files alongside `.ts` source files. If `tsc` output lands in the source directory, the `outDir` tsconfig setting is wrong. Only `dist/` should contain compiled output.
- Docker `__dirname` math: `rootDir: ".."` in server/tsconfig means compiled output is at `server/dist/server/src/index.js`. So `__dirname` at runtime = `/app/server/dist/server/src/`. Client dist path is `../../../../client/dist` (4 levels up). The sister project Dockerfile documents this pattern — always check it first.
- Confusing Express and React Router catch-all syntax — Express 5 uses `/{*path}`, React Router uses `path="*"`

**React + Accessibility:**
- Using `useEffect` for data fetching instead of TanStack Query
- Making files longer than 200 lines instead of splitting
- Framer Motion animations are JS-driven (RAF springs/tweens) — CSS `prefers-reduced-motion` rule does NOT suppress them. Use `<MotionConfig reducedMotion="user">` at the app root. This is the ONLY way to respect OS-level reduced motion for Framer Motion.
- Never wrap ARIA child roles in plain `div`/`motion.div` — e.g., a `motion.div` between `role="listbox"` and `role="option"` breaks the ownership model. Apply motion props directly on the semantic element.

**Patterns:**
- Forgetting the intent block at top of new files
- When adding new product mix types or aggregation categories, use the parameterized field extractor pattern (`computeProductMix(items, getCategory)`) instead of duplicating the aggregation function. See `data-aggregator.ts`.

## Integration Contracts (MANDATORY for multi-task plans)

When creating a utility function, hook, or state field, ALWAYS verify:

1. **Every exported function is imported somewhere.** Run `grep -r "functionName" client/src/` to confirm. An unused export is a bug.
2. **State flows end-to-end.** If a UI control changes state (e.g., AND/OR toggle), that state must propagate through: UI component → hook → engine/consumer. Local state that doesn't affect behavior is a bug.
3. **Aggregation utils must be called.** Creating a utility is useless unless the consuming hook actually imports and calls it.
4. **Default values must match across files.** If `useSort` defaults to `{field: 'revenue', direction: 'desc'}`, then any `sortActive` check must compare against `'desc'`, not `'asc'`.
5. **ARIA semantics must match interaction model.** In a multi-select listbox, `aria-selected` reflects checkbox state (multi-select), not which item is focused/active. Use `aria-current` for the active item.
