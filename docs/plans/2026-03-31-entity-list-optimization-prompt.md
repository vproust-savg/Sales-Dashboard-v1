# Execution Prompt — Entity List Optimization

Paste this into a fresh Claude Code Opus 4.6 (1M context) session.

---

## Prompt

You are implementing the **Entity List Optimization** for a sales dashboard. This is a major feature with 8 sub-features across 15 implementation tasks.

**Read these files first (in this order):**

1. `CLAUDE.md` — Project rules, tech stack, file structure, common mistakes
2. `docs/specs/2026-03-31-entity-list-optimization.md` — Full design spec (8 features, 597 lines)
3. `docs/plans/2026-03-31-entity-list-optimization.md` — Implementation plan (15 tasks with exact code, TDD test cases, visual checkpoints)

**Use these skills during execution:**

- `/executing-plans` — Execute the plan task-by-task with review checkpoints
- `/test-driven-development` — Write failing tests BEFORE implementation for backend Tasks 3, 5, 6, 8
- `/feature-dev:feature-dev` — Architecture-first approach for frontend components (Tasks 10, 11, 12)
- `/frontend-design` — For visual components (AllEntityEntry, FetchAllDialog, FetchAllProgress)
- `/systematic-debugging` — When hitting any bug during implementation

**Visual review is mandatory.** After Tasks 9, 10, 11, 14, and 15, take a screenshot of the running app (http://localhost:5173/) using Chrome plugin or preview MCP and verify the visual output matches the spec. The plan file has a detailed visual checkpoint table — follow it exactly.

**Start both dev servers first:**
```bash
cd server && npm run dev   # Express on port 3001
cd client && npm run dev   # Vite on port 5173
```

**Execute the 15 tasks in order.** Tasks 1-7 are backend, Tasks 8-14 are frontend, Task 15 is verification. Backend tasks require TDD (write tests first). Frontend tasks require visual review (screenshot after each visible change).

**Pre-deploy checklist (run after Task 15):**
```bash
cd client && npx tsc -b --noEmit   # Client TS build
cd ../server && npx tsc --noEmit   # Server TS build
cd ../server && npx vitest run     # Server tests (all must pass)
cd ../client && npx vite build     # Client bundle (<500KB gzip)
```

Begin by reading the three files listed above, then start with Task 1 from the plan.
