# Priority ERP — Sales Interactive Dashboard

## What is this project?

A master-detail sales dashboard that visualizes Priority ERP sales data. Left panel shows a filterable, searchable entity list (customers, zones, vendors, brands, product types, products). Right panel shows KPIs, charts, and detailed tables for the selected entity.

Embedded in Airtable via Omni. Deployed on Railway via Dockerfile.

**Data flow:** Priority oData API → Express backend → Upstash Redis cache → React frontend
**Language:** TypeScript strict mode throughout. Zero plain JavaScript.
**Maintained by:** Claude Code (sole developer). Reviewed by Grok, Deepseek, Gemini, Minimax.

## Safety Constraints

- **Priority ERP is READ-ONLY.** The dashboard must NEVER write data to Priority. No POST, PUT, PATCH, DELETE. This is non-negotiable.
- **Test customer:** `C7826` — use for all validation and testing.
- **No secrets in source code.** Priority credentials and Redis tokens live in `.env` only.

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

**Pre-deploy checklist:**
```bash
cd client && npx tsc -b --noEmit   # Client TS build
cd ../server && npx tsc --noEmit   # Server TS build
cd ../server && npx vitest run     # Server tests (63 total, 61 pass — 2 formatDays tests have test-code mismatch)
cd ../client && npx vite build     # Client bundle (must be <500KB gzip)
```
All must pass — any TypeScript error kills the Railway Docker build.
Also verify: no `any` types (`grep -rn ": any\|as any" server/src/ client/src/`), no files >200 lines, no secrets in source.

## Project Structure

```
├── CLAUDE.md             ← Project memory and instructions for Claude
├── server/               ← Backend (Express + TypeScript)
│   └── src/
│       ├── routes/       ← API route handlers
│       ├── services/     ← Priority ERP client, data aggregation
│       ├── cache/        ← Redis cache layer
│       └── middleware/   ← Auth, error handling, validation
├── client/               ← Frontend (React + Vite + Tailwind)
│   └── src/
│       ├── components/
│       │   ├── left-panel/   ← Entity list, search, filters, sort
│       │   ├── right-panel/  ← KPIs, charts, tabs
│       │   │   ├── BestSellers.tsx          ← Paginated list (25 items, shift-by-5)
│       │   │   ├── ProductMixCarousel.tsx   ← 5-type donut carousel with arrows/dots
│       │   │   └── ...
│       │   └── shared/       ← Reusable: Tooltip, CopyableId, Skeleton, etc.
│       ├── hooks/            ← Custom hooks (data fetching, filters, sort, export)
│       ├── layouts/          ← Master-detail layout
│       ├── styles/           ← Tailwind config, design tokens
│       └── utils/            ← Frontend utilities
├── shared/               ← Shared TypeScript types + utilities
│   ├── types/            ← API response shapes, shared interfaces
│   └── utils/            ← Shared utility functions
├── docs/                 ← Project documentation
│   ├── specs/            ← Design specifications
│   ├── plans/            ← Implementation plans
│   ├── evals/            ← Evaluation criteria
│   ├── decisions/        ← Architecture Decision Records (ADRs)
│   └── runbooks/         ← Operational procedures (deploy, cache, etc.)
├── learnings/            ← Development discoveries and lessons learned (ALWAYS UPDATE)
├── tools/                ← Reference files, useful links (READ ONLY)
├── Dockerfile            ← Multi-stage Docker build (Railway)
├── railway.json          ← Railway config — DO NOT DELETE
└── .dockerignore         ← Excludes node_modules, .env, .git
```

**Parallel session rules:** Plan 0 creates `shared/` first. Then backend session only writes to `server/`. Frontend session only writes to `client/`. Neither session should modify `shared/` or `CLAUDE.md`.

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

## Useful Skills & References

**Top skills for the implementation workflow:**

| Skill | Type | Use for |
|-------|------|---------|
| `subagent-driven-development` | superpowers | Implementation — fresh subagent per task with two-stage review |
| `receiving-code-review` | superpowers | Fix agent processes eval findings in iteration loop |
| `requesting-code-review` | superpowers | Inline review checkpoints during implementation |
| `verification-before-completion` | superpowers | Evidence before completion claims |
| `frontend-design` | superpowers | Distinctive React + Tailwind interfaces |
| `design-critique` | superpowers | Visual fidelity review via Chrome plugins |
| `priority-erp-api` | custom | Priority ERP OData patterns, sub-form handling |
| `railway-deploy` | custom | Railway deployment guardrails for TypeScript + Docker |

| `systematic-debugging` | superpowers | When a bug arises during development — diagnose root cause, don't guess |

**Full catalog:** `tools/useful-links.md`

**Bug handling:** When you hit a bug during implementation, use `/systematic-debugging` to diagnose and fix it yourself. Do not skip past errors or ask the user — investigate the root cause, fix it, verify the fix, then continue.

## Dashboard Architecture

**Master-detail pattern:** Two panels fill the viewport (100vh - 32px, max 1440px).
- Left panel (280px fixed): Scrollable entity list with dimension toggles, search, filter, sort, multi-select
- Right panel (flex: 1): KPIs, charts, tabs (orders, items, contacts)

**Dimension switching:** 6 dimensions (Customers, Zone, Vendors, Brands, Prod. Type, Products). Same API endpoint with different `groupBy` parameter. Dashboard template stays the same; only the list entity and labels change.

**Period selection:** YTD loads by default. Year tabs auto-show based on availability API. Click a year → fetch on-demand → cache client-side.

**Multi-select:** Circular checkboxes on list items. "View Consolidated" aggregates all KPIs/charts/tables for selected entities.

**Charts row:** Two cards side by side (3fr + 5fr grid).
- Product Mix carousel: 5 donut chart types (Product Type, Product Family, Brand, Country of Origin, FS vs Retail) with left/right arrow navigation, dot indicators, wrap-around, keyboard accessible. Uses `ProductMixType` from shared types and `PRODUCT_MIX_ORDER` for sequence.
- Best Sellers: 25 items with overlapping pagination (shift by 5, show 10). Custom dark tooltip on hover. Filters zero-value items on both server and client.

**Design spec:** `docs/specs/2026-03-29-sales-dashboard-design.md`
**Mockup reference:** `docs/specs/dashboard-mockup-v5-reference.png`

## Execution Workflow

The project follows a spec → plan → eval → iteration loop pipeline:

| Document | Path | Content |
|----------|------|---------|
| Design spec | `docs/specs/2026-03-29-sales-dashboard-design.md` | 25 sections, 1900+ lines — the single source of truth |
| Plan 0 (shared) | `docs/plans/2026-03-30-plan-0-shared-foundation.md` | Shared types + formatting utils (2 tasks) |
| Plan A (backend) | `docs/plans/2026-03-30-plan-a-backend.md` | Express + Priority client + Redis cache (Tasks 0, 3-12. Tasks 1-2 moved to Plan 0) |
| Plan B (frontend) | `docs/plans/2026-03-30-plan-b-frontend-shell.md` | React components with mock data (19 tasks) |
| Plan C (integration) | `docs/plans/2026-03-30-plan-c-integration.md` | Wire real data + interactions + deploy (12 tasks) |
| Eval A | `docs/evals/2026-03-30-plan-a-backend-eval.md` | 39 checks, 2 review checkpoints |
| Eval B | `docs/evals/2026-03-30-plan-b-frontend-eval.md` | 60 checks, 3 review checkpoints |
| Eval C | `docs/evals/2026-03-30-plan-c-integration-eval.md` | 53 checks, 3 review checkpoints |
| Iteration loop | `docs/evals/eval-fix-iteration-loop.md` | Post-implementation eval-fix cycle (max 3 iterations) |

**Execution order:** Plan 0 runs first (shared types). Then Plans A + B run in parallel (server/ vs client/ ownership). Plan C runs after both.
**Implementation skill:** Use `/subagent-driven-development` — fresh subagent per task with two-stage review.
**Post-implementation:** Each eval has a Post-Implementation Eval-Fix Loop section. Run full eval → fix failures → re-run (max 3 iterations). Protocol in `eval-fix-iteration-loop.md`.

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

| Token | Hex | Usage |
|-------|-----|-------|
| bg-page | #f5f1eb | Page background |
| bg-card | #ffffff | All cards, panels |
| gold-primary | #b8a88a | Accents, active borders, links |
| gold-light | #d4c5a9 | Chart bars (current year) |
| gold-muted | #e8e0d0 | Chart bars (previous year) |
| gold-subtle | #f0ece5 | Borders, inactive badges |
| gold-hover | #faf8f4 | Hover states |
| dark | #2c2a26 | Active elements, dark buttons |
| text-primary | #1a1a1a | Main text |
| text-secondary | #555 | Sub-values |
| text-muted | #999 | Labels, metadata |
| green | #22c55e | Positive trends |
| red | #ef4444 | Negative trends |
| dark-hover | #3d3a35 | Hover state for dark buttons |
| text-faint | #bbbbbb | Very subtle text (below text-muted) |
| yellow | #eab308 | Warning/secondary accent |
| blue | #3b82f6 | Alternative accent |

**Font stack:** `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif`

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
- **Sister project:** `/Users/victorproust/Documents/Work/SG Interface/Priority Reports/` — same stack (Express + React + Railway), same Priority API. Read its code when stuck on API patterns, Docker config, or Railway deployment.

## Common Mistakes (avoid these)

- Using Tailwind v3 config patterns — v4 uses CSS-native `@theme` in `index.css`, NOT `tailwind.config.js`
- Using `useEffect` for data fetching instead of TanStack Query
- Hardcoding Tailwind colors instead of the design token palette
- Dynamic Tailwind classes like `` col-span-${n} `` — use a mapping object
- Making files longer than 200 lines instead of splitting
- Forgetting the intent block at top of new files
- Interpolating user input directly into OData `$filter` queries — validate with Zod
- Confusing Express and React Router catch-all syntax — Express 5 uses `/{*path}`, React Router uses `path="*"`
- `$expand` on DOCUMENTS_P is BROKEN — use two-step `enrichRows` pattern instead
- URL encoding trap: do NOT use `searchParams.set()` for `$expand` — it double-encodes `$select`. Build the URL string with raw concatenation.
- Priority has TWO error response formats: JSON `{ "odata.error": { "message": { "value": "..." } } }` and plain text. Parse both. The key `"odata.error"` has a DOT in the name — use `obj['odata.error']` (bracket notation), NOT `obj.error`. The message is nested: `.message.value`, not `.message` directly.
- Custom fields on ORDERITEMS follow the `Y_XXXX_5_ESH` naming pattern (e.g., `Y_2K28_5_ESH` for vendor code)
- Docker `__dirname` math: `rootDir: ".."` in server/tsconfig means compiled output is at `server/dist/server/src/index.js`. So `__dirname` at runtime = `/app/server/dist/server/src/`. Client dist path is `../../../../client/dist` (4 levels up). The sister project Dockerfile documents this pattern — always check it first.
- Leaving unused variables — `noUnusedLocals: true` means `tsc -b` fails, killing the Railway Docker build
- Deleting `railway.json` — Railway needs this file for Dockerfile builder
- Framer Motion animations are JS-driven (RAF springs/tweens) — CSS `prefers-reduced-motion` rule does NOT suppress them. Use `<MotionConfig reducedMotion="user">` at the app root. This is the ONLY way to respect OS-level reduced motion for Framer Motion.
- Never wrap ARIA child roles in plain `div`/`motion.div` — e.g., a `motion.div` between `role="listbox"` and `role="option"` breaks the ownership model. Apply motion props directly on the semantic element.
- Never commit compiled `.js` files alongside `.ts` source files. If `tsc` output lands in the source directory, the `outDir` tsconfig setting is wrong. Only `dist/` should contain compiled output.
- CSS Grid equal-height trap: `items-start` on a grid prevents columns from stretching to the same height. Remove it to use the default `stretch`. To make a card fill its grid cell, use `h-full flex-col justify-between` — extra height becomes spacing between sections. Do NOT use ResizeObserver + `flex-1` to grow a chart inside a grid cell — flex-1 has no height constraint in a grid cell and will expand infinitely.
- When adding new product mix types or aggregation categories, use the parameterized field extractor pattern (`computeProductMix(items, getCategory)`) instead of duplicating the aggregation function. See `data-aggregator.ts`.

## Integration Contracts (MANDATORY for multi-task plans)

When creating a utility function, hook, or state field, ALWAYS verify:

1. **Every exported function is imported somewhere.** Run `grep -r "functionName" client/src/` to confirm. An unused export is a bug.
2. **State flows end-to-end.** If a UI control changes state (e.g., AND/OR toggle), that state must propagate through: UI component → hook → engine/consumer. Local state that doesn't affect behavior is a bug.
3. **Aggregation utils must be called.** Creating a utility is useless unless the consuming hook actually imports and calls it.
4. **Default values must match across files.** If `useSort` defaults to `{field: 'revenue', direction: 'desc'}`, then any `sortActive` check must compare against `'desc'`, not `'asc'`.
5. **ARIA semantics must match interaction model.** In a multi-select listbox, `aria-selected` reflects checkbox state (multi-select), not which item is focused/active. Use `aria-current` for the active item.
