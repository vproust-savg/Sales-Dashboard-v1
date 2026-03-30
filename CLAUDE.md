# Priority ERP — Sales Interactive Dashboard

## What is this project?

A master-detail sales dashboard that visualizes Priority ERP sales data. Left panel shows a filterable, searchable entity list (customers, zones, vendors, brands, product types, products). Right panel shows KPIs, charts, and detailed tables for the selected entity.

Embedded in Airtable via Omni. Deployed on Railway via Dockerfile.

**Data flow:** Priority oData API → Express backend → Upstash Redis cache → React frontend
**Language:** TypeScript strict mode throughout. Zero plain JavaScript.
**Maintained by:** Claude Code (sole developer). Reviewed by Grok, Deepseek, Gemini, Minimax.

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
```
Both must pass — any TypeScript error kills the Railway Docker build.

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
│       ├── components/   ← React components
│       ├── hooks/        ← Custom hooks (data fetching, filters)
│       ├── layouts/      ← Master-detail layout
│       ├── styles/       ← Tailwind config, design tokens
│       └── utils/        ← Frontend utilities
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

**Parallel session rules:** Backend session only writes to `server/`. Frontend session only writes to `client/`. Shared code in `shared/` must be created before either session starts. Neither session should modify `CLAUDE.md`.

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

**Reference file:** `tools/useful-links.md` — Full catalog of reviewed GitHub repos and Claude Code skills, sorted by relevance.

**Top skills to leverage during development:**

| Skill | Source | Use for |
|-------|--------|---------|
| `ui-ux-pro-max-skill` | [nextlevelbuilder](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | Chart type selection (25 types with accessibility grades), React performance patterns, UX guidelines, pre-delivery accessibility checklist |
| `frontend-design` | Installed (superpowers) | Distinctive React + Tailwind interfaces — fights generic AI aesthetics |
| `Docker Development` | [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) | Multi-stage Node.js/TS build patterns for Railway Dockerfile |
| `CI/CD Pipeline Builder` | [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) | GitHub Actions automation for Railway deploy pipeline |
| `claude-code-spec-workflow` | [jqueryscript list](https://github.com/jqueryscript/awesome-claude-code) | Spec → Design → Tasks → Implementation workflow |
| `Ralph Wiggum Loop` | [hesreallyhim list](https://github.com/hesreallyhim/awesome-claude-code) | Autonomous build/test/fix development cycles |
| `webapp-testing` | Anthropic official | Playwright-based E2E testing for the dashboard |
| `priority-erp-api` | Installed (custom) | Priority ERP OData patterns, sub-form handling, rate limiting |
| `railway-deploy` | Installed (custom) | Railway deployment guardrails for TypeScript + Docker |

## Dashboard Architecture

**Master-detail pattern:** Two panels fill the viewport (100vh - 32px, max 1440px).
- Left panel (280px fixed): Scrollable entity list with dimension toggles, search, filter, sort, multi-select
- Right panel (flex: 1): KPIs, charts, tabs (orders, items, contacts)

**Dimension switching:** 6 dimensions (Customers, Zone, Vendors, Brands, Prod. Type, Products). Same API endpoint with different `groupBy` parameter. Dashboard template stays the same; only the list entity and labels change.

**Period selection:** YTD loads by default. Year tabs auto-show based on availability API. Click a year → fetch on-demand → cache client-side.

**Multi-select:** Circular checkboxes on list items. "View Consolidated" aggregates all KPIs/charts/tables for selected entities.

**Design spec:** `docs/specs/2026-03-29-sales-dashboard-design.md`
**Mockup reference:** `docs/specs/dashboard-mockup-v5-reference.png`

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
- Modifying Dockerfile paths without checking `__dirname` math
- Leaving unused variables — `noUnusedLocals: true` means `tsc -b` fails, killing the Railway Docker build
- Deleting `railway.json` — Railway needs this file for Dockerfile builder
