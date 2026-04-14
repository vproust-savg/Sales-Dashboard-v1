# Plan 0: Shared Foundation

> **For agentic workers:** This plan MUST complete before Plans A and B start. It creates the shared TypeScript types and utilities that both the server and client depend on.

**Goal:** Create the shared types (dashboard data shapes, API response envelope) and utilities (number/date formatting) that form the contract between server and client.

**Depends on:** Nothing
**Produces:** `shared/types/dashboard.ts`, `shared/types/api-responses.ts`, `shared/utils/formatting.ts` — used by both Plan A (backend) and Plan B (frontend)
**Eval:** No separate eval. Verified by Plan A's TypeScript compilation and formatting tests.

**Spec reference:** `docs/specs/2026-03-29-sales-dashboard-design.md` — Section 10 (KPI formulas), Section 18 (field mapping)

---

## Task 0: Shared Types — Dashboard Data Shapes

**Files:**
- Create: `shared/types/dashboard.ts`
- Create: `shared/types/api-responses.ts`

> **Note:** This task was originally Plan A Task 1. The complete code (types, interfaces, JSDoc comments) is in `docs/plans/2026-03-30-plan-a-backend.md` Task 1. Copy it verbatim.

- [ ] **Step 1:** Write `shared/types/dashboard.ts` — all interfaces from Plan A Task 1 Step 1
- [ ] **Step 2:** Write `shared/types/api-responses.ts` — ApiResponse + ApiError from Plan A Task 1 Step 2
- [ ] **Step 3:** Commit

```bash
git add shared/types/dashboard.ts shared/types/api-responses.ts
git commit -m "feat(shared): add dashboard data types and API response envelope"
```

---

## Task 1: Shared Utils — Number Formatting

**Files:**
- Create: `shared/utils/formatting.ts`

> **Note:** This task was originally Plan A Task 2. The complete code (8 formatting functions + 16 tests) is in `docs/plans/2026-03-30-plan-a-backend.md` Task 2. Copy it verbatim. Tests are created by Plan A Task 0 (server scaffolding needed for Vitest), so formatting.ts is created here but tested after Plan A Task 0 runs.

- [ ] **Step 1:** Write `shared/utils/formatting.ts` — all 8 functions from Plan A Task 2 Step 3
- [ ] **Step 2:** Commit

```bash
git add shared/utils/formatting.ts
git commit -m "feat(shared): add currency, percent, date formatting utilities"
```

---

## Done

After these 2 tasks complete, Plans A and B can start in parallel:
- **Plan A** starts at Task 0 (server scaffolding) → then Task 3 (config). Tasks 1-2 are marked as "completed by Plan 0."
- **Plan B** starts at Task 0 (client scaffolding) → proceeds through all tasks.
