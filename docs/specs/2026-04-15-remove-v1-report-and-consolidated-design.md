# Remove v1 Report & View Consolidated (Design)

**Date:** 2026-04-15
**Author:** Claude Opus 4.6 (main conversation, explanatory mode)
**Scope:** Delete the broken v1 "Report" (`AllEntityEntry` / `__ALL__`) and v1 "View Consolidated" (`SelectionBar` dark button) code paths. Rename the surviving v2 surface to drop the `2` suffix now that there is only one implementation.
**Status:** Design approved. Awaiting `/writing-plans` to produce the step-by-step implementation plan.
**Prior art:**
- `docs/specs/2026-04-14-report-2-and-consolidated-2-design.md` — introduced v2 alongside v1
- `docs/specs/2026-04-14-surgical-fixes.md` — fixed v2 bugs; explicitly flagged v1 as "dead weight to remove in a follow-up"

---

## Context

The dashboard has shipped two parallel implementations of the same two features since commit `66cd417`:

| Feature | v1 (broken) | v2 (working) |
|---|---|---|
| "Load all entities + aggregate" | `AllEntityEntry` pinned row → `FetchAllDialog` → `useFetchAll` → `__ALL__` pseudo-entity | `ReportButton` → `Report2FilterModal` → `useReport2` → `ConsolidatedHeader` |
| "View checked entities consolidated" | `SelectionBar` v1 button → `useEntitySelection.viewConsolidated` → `useConsolidatedDashboard` | `ViewConsolidated2Button` → `Consolidated2ConfirmModal` → `useConsolidated2` |

v2 was built as a fresh parallel surface specifically so v1 could be removed cleanly in a follow-up. That follow-up is this spec.

### Why remove v1 now
1. **It is broken in production.** v1 triggered the symptom that required surgical-fixes (`2026-04-14-surgical-fixes.md`) on the v2 side. v1 itself was never fixed — users who hit the old button get the original bugs.
2. **It is dead weight.** Every prop, hook, and handler that exists only for v1 is load-bearing for nothing. `DashboardLayout` destructures 11 v1-only fields; `useDashboardState` returns 9; `useEntitySelection` exports 2.
3. **The `2` suffix is now a lie.** Nothing else is called "1" — the suffix only existed because two versions coexisted. With v1 gone, `useReport2` is "the Report hook."
4. **Cognitive load on future edits.** Anyone modifying the dashboard has to read both paths to understand which one fires; deleting v1 removes that branch permanently.

### What this spec does NOT do
- Does not touch the `/api/sales/fetch-all` or `/api/sales/dashboard` endpoints. Both are reused by v2.
- Does not modify any Priority ERP integration code, Redis client, or cache layer.
- Does not change user-visible behavior of the v2 flows — only labels (drop "2").
- Does not remove `useConsolidatedContacts`, `useCacheStatus`, `ConsolidatedHeader`, `ConsolidatedOrdersTable`, or `ConsolidatedContactsTable` — all v2 dependencies.

---

## Approach: two commits on a feature branch

Work happens on `chore/remove-v1`; merge to `main` with **"Rebase and merge" or a standard merge commit — NOT squash** so both commits survive on `main` as independently revertable units.

### Commit 1 — `chore: remove v1 Report and View Consolidated`
Pure deletion. No renames. After this commit the project is functionally v2-only but every identifier still carries the `2` suffix. All four pre-deploy checks (`tsc -b`, `tsc`, `vitest run`, `vite build`) must pass before the commit is pushed.

### Commit 2 — `refactor: rename Report 2 / Consolidated 2 to Report / Consolidated`
Pure mechanical rename. `git mv` for files, **identifier-aware rename** for symbols (prefer the editor's "Rename Symbol" refactor; if using grep, anchor patterns at word boundaries, e.g. `\buseReport2\b`, not bare `report2`, to avoid matching unrelated substrings in comments, copy, or test fixtures), and a single literal update of the Redis cache key string (`report2_payload` → `report_payload`). All four pre-deploy checks must pass again.

### Why this order and not atomic
Mid-edit invariants. Between "3 of 7 files renamed" and "all 7 renamed" the codebase does not type-check. By doing deletes first we empty the `Report` / `ViewConsolidated` namespace before anything else is renamed into it, so the rename cannot silently alias onto a v1 symbol.

---

## Deletion inventory (commit 1)

### Client — files deleted outright
| Path | Why it dies |
|---|---|
| `client/src/components/left-panel/AllEntityEntry.tsx` | The v1 pinned "Load All" row above the entity list |
| `client/src/components/shared/FetchAllDialog.tsx` | v1 filter-selection modal (superseded by `Report2FilterModal`) |
| `client/src/components/right-panel/FetchAllProgress.tsx` | v1 inline progress card (superseded by `Report2ProgressModal`) |
| `client/src/hooks/useFetchAll.ts` | v1 SSE hook (v2 uses `useReport2`, which calls the same endpoint) |
| `client/src/layouts/select-display-dashboard.ts` | v1 display selector; no longer needed once `__ALL__` and `isConsolidated` are gone |
| `client/src/layouts/__tests__/select-display-dashboard.test.ts` | Companion test — deletes alongside the module it tests |

### Client — files modified (surgical removals)
| Path | Removals |
|---|---|
| `client/src/hooks/useEntitySelection.ts` | Remove `isConsolidated` state + `viewConsolidated` action. Keep `selectedIds`, `toggleCheckbox`, `clearSelection`, `selectEntity`, `activeEntityId`, `resetSelection` — all still used by v2. |
| `client/src/hooks/useDashboardData.ts` | Remove the `useConsolidatedDashboard` export. Keep `useEntities` + `useDashboardDetail`. |
| `client/src/hooks/useDashboardState.ts` | Drop returned fields: `fetchAllLoadState`, `fetchAllProgress`, `allDashboard`, `dataLoaded`, `startFetchAll`, `abortFetch`, `isConsolidated`, `isConsolidatedLoading`, `viewConsolidated`. Drop the `consolidatedQuery` internal. Drop the `useFetchAll` import. Drop the `useConsolidatedDashboard` call. Simplify `finalDashboard` — it no longer needs to branch on `isConsolidated`. |
| `client/src/components/left-panel/SelectionBar.tsx` | Delete the v1 dark button (~lines 54–67) and the `onViewConsolidated` prop. Keep the v2 `ViewConsolidated2Button`. |
| `client/src/components/left-panel/EntityList.tsx` | Remove the `<AllEntityEntry>` render and the six props that feed it (`dataLoaded`, `fetchAllLoadState`, `allDashboard`, `entitiesWithOrders`, `onAllClick`, `onRefresh`). |
| `client/src/components/left-panel/LeftPanel.tsx` | Drop the same six props from the interface and their pass-through to `EntityList`. Also drop the `onViewConsolidated` prop. |
| `client/src/layouts/DashboardLayout.tsx` | Delete: `dialogOpen`/`setDialogOpen`, `dialogRefresh`/`setDialogRefresh`, `entitiesWithOrders`, `handleAllClick`, `handleRefresh`, `handleDialogConfirm`, `isAllActive`, the `<FetchAllDialog>` render, the `<FetchAllProgress>` render, the `isConsolidatedLoading` placeholder text, the import of `selectDisplayDashboard`, the import of `FetchAllDialog`/`FetchAllProgress`. The `displayDashboard` local becomes `dashboard` directly. |
| `client/src/layouts/dashboard-layout-types.ts` | Drop the v1 props from `DashboardLayoutProps`. |

### Server — files modified
Nothing gets deleted server-side. Both endpoints (`/api/sales/fetch-all`, `/api/sales/dashboard`) and every helper (`filterOrdersByEntityIds`, `readFirstMatchingRaw`, etc.) are called by v2.

**Grep guardrail** during implementation: before declaring "nothing server-side to delete," run `grep -rn "useFetchAll\|useConsolidatedDashboard\|AllEntityEntry\|FetchAllDialog\|FetchAllProgress" server/` to confirm zero server references.

### Shared types
| Path | Change |
|---|---|
| `shared/types/dashboard.ts` | Remove `EntityListLoadState` (v1-only). **Keep** `FetchAllFilters` and `SSEProgressEvent` — both are consumed by `useReport2`. |

### Server cache keys
Nothing changes in commit 1. All cache keys stay as-is (including `report2_payload`, renamed in commit 2).

---

## Rename inventory (commit 2)

### File renames (via `git mv` to preserve history)
| Before | After |
|---|---|
| `client/src/hooks/useReport2.ts` | `client/src/hooks/useReport.ts` |
| `client/src/hooks/useConsolidated2.ts` | `client/src/hooks/useConsolidated.ts` |
| `client/src/components/left-panel/Report2Button.tsx` | `client/src/components/left-panel/ReportButton.tsx` |
| `client/src/components/left-panel/ViewConsolidated2Button.tsx` | `client/src/components/left-panel/ViewConsolidatedButton.tsx` |
| `client/src/components/shared/Report2FilterModal.tsx` | `client/src/components/shared/ReportFilterModal.tsx` |
| `client/src/components/shared/Report2ProgressModal.tsx` | `client/src/components/shared/ReportProgressModal.tsx` |
| `client/src/components/shared/Consolidated2ConfirmModal.tsx` | `client/src/components/shared/ConsolidatedConfirmModal.tsx` |

### Identifier renames (find-and-replace across `client/`, `server/`, `shared/`)
| Before | After |
|---|---|
| `useReport2` | `useReport` |
| `useConsolidated2` | `useConsolidated` |
| `Report2Button` | `ReportButton` |
| `ViewConsolidated2Button` | `ViewConsolidatedButton` |
| `Report2FilterModal` / `Report2FilterModalContent` | `ReportFilterModal` / `ReportFilterModalContent` |
| `Report2ProgressModal` | `ReportProgressModal` |
| `Consolidated2ConfirmModal` | `ConsolidatedConfirmModal` |
| `report2` (field in `useDashboardState` return, local vars, props) | `report` |
| `consolidated2` (field in `useDashboardState` return, local vars, props) | `consolidated` |
| `'report2'` and `'consolidated2'` in `activeView: 'single' \| 'report2' \| 'consolidated2'` | `'report'` and `'consolidated'` |
| `onReport2Click` / `handleReport2Click` / `handleReport2Start` | `onReportClick` / `handleReportClick` / `handleReportStart` |
| `onViewConsolidated2` / `handleViewConsolidated2Click` / `handleConsolidated2Start` | `onViewConsolidatedClick` / `handleViewConsolidatedClick` / `handleConsolidatedStart` |
| `onGoToReport2` | `onGoToReport` |

### UI labels
| Before | After |
|---|---|
| `"Report 2"` (left-panel button text) | `"Report"` |
| `"View Consolidated 2"` (selection-bar button text) | `"View Consolidated"` |
| `aria-label="Report 2 filters"` (modal) | `aria-label="Report filters"` |
| Any other "2" in user-facing copy | dropped |

### Server cache key
| Path | Change |
|---|---|
| `server/src/cache/cache-keys.ts` | The string literal `report2_payload` → `report_payload` in the `cacheKey(...)` helper. |
| Any caller writing or reading that key | Update through the helper — no direct literals expected. |

Existing `report2_payload:*` entries in Upstash Redis will orphan and expire per their 1-hour TTL. Worst case for a user: one forced Report refetch (~4–7 min per the progress-modal estimate) on first use after deploy.

### NOT renamed (explicit preservation)
- `ConsolidatedHeader`, `ConsolidatedOrdersTable`, `ConsolidatedContactsTable`, `PerCustomerToggle`, `PerCustomerKPITable`, `PerCustomerChartTable` — these never had the `2` suffix and describe the general consolidated-view concept, which survives.
- `useConsolidatedContacts` — the name describes a server-side concept (multi-customer contacts endpoint), not a v2 flag.
- `FetchAllFilters` type — still the right name for the shape of filters sent to the fetch-all SSE endpoint.

---

## Revertability plan

### Before touching any code
```bash
git tag pre-v1-removal
git push origin pre-v1-removal
```
This pins the current HEAD as a named anchor. Any rollback can reach this point via `git reset --hard pre-v1-removal` regardless of what happens during the removal.

**Verify `main` is green before starting** — don't begin a removal from a broken base:
```bash
cd client && npx tsc -b --noEmit
cd ../server && npx tsc --noEmit
cd ../server && npx vitest run
cd ../client && npx vite build
```

### Branch and merge protocol
1. Work on branch `chore/remove-v1` off current `main`.
2. Commit 1 and commit 2 land as separate commits on the branch.
3. Open a PR (self-review is fine).
4. **Merge strategy: "Rebase and merge" or a standard merge commit — NOT "Squash and merge."** Squashing destroys the two-commit boundary that makes the rename independently revertable from the deletion.
5. After merge, Railway auto-deploys the merge commit.

### Per-commit revertability contract
Each of the two commits must independently pass:
- `cd client && npx tsc -b --noEmit`
- `cd server && npx tsc --noEmit`
- `cd server && npx vitest run` (all 121 existing tests)
- `cd client && npx vite build` (bundle < 500 KB gzip)

If commit 1 passes but commit 2 breaks, commit 1 is kept and commit 2 is retried locally. No broken state ever reaches `main`.

### Rollback paths

| Scenario | Action | Recovery time |
|---|---|---|
| Deploy breaks prod, need instant recovery | Railway dashboard → "Redeploy" on the pre-merge image | ~30 s, no git |
| Rename caused a regression, deletion is fine | `git revert <commit-2-sha>` → push | ~3 min (Railway redeploys) |
| Deletion removed something still needed | `git revert <commit-1-sha>` → push | ~3 min |
| Both commits need reverting | Revert commit 2, then commit 1 → push | ~3 min |
| Nuclear (everything on fire) | `git reset --hard pre-v1-removal && git push --force origin main` | ~3 min — **requires explicit user approval per `CLAUDE.md` safety rule** |

### Revert-safety of specific changes
- **Redis cache key rename**: safe both ways. Reverting commit 2 makes code read `report2_payload` again; any orphan `report_payload:*` entries sit until TTL expiry. Worst case per direction: one forced refetch.
- **File renames via `git mv`**: git's rename detection keeps `git log --follow` and `git blame` intact across the rename. Post-rename, inspecting the history of `useReport.ts` shows the full v2 lineage.
- **No database migrations, no persistent user state, no Priority writes**.

### Operator anti-patterns (explicitly forbidden)
- ❌ No `git commit --amend` after push (rewrites SHAs, defeats SHA-based revert)
- ❌ No `git push --force` except the nuclear option above with explicit user permission
- ❌ No skipping pre-commit hooks (`--no-verify`)
- ❌ No bundling unrelated changes into either commit (CLAUDE.md: "one concern per commit")
- ❌ No "Squash and merge" on the PR

---

## Verification plan

Runs after each of the two commits (local) and once more post-merge on the Railway preview.

### Automated
```bash
cd client && npx tsc -b --noEmit        # must exit 0
cd ../server && npx tsc --noEmit         # must exit 0
cd ../server && npx vitest run           # 121 existing tests + any that move with deleted files
cd ../client && npx vite build           # bundle < 500 KB gzip
```

Additional grep guardrails after commit 1:
```bash
grep -rn "AllEntityEntry\|useFetchAll\|FetchAllDialog\|FetchAllProgress" client/src/ server/src/ shared/
grep -rn "__ALL__\|isConsolidated\|viewConsolidated\|useConsolidatedDashboard" client/src/
# Both must return zero matches.
```

Additional grep guardrails after commit 2:
```bash
grep -rn "Report2\|report2\|Consolidated2\|consolidated2" client/src/ server/src/ shared/
grep -rn "report2_payload" server/src/
# All must return zero matches.
```

### Manual smoke test (Railway preview URL)

1. **Left panel structure.** Load the dashboard. Confirm:
   - No pinned "Load All" row above the entity list.
   - Only the "Report" button is visible (was labeled "Report 2").
2. **Selection bar.** Check 2+ entities in the list. Confirm:
   - Only ONE "View Consolidated" button appears (not two).
   - The button is labeled "View Consolidated" (was "View Consolidated 2").
3. **Report flow.** Click Report → filter modal opens → dropdowns are empty → pick filter → Start → progress modal → consolidated view renders with `ConsolidatedHeader`.
4. **Report re-open cleanliness.** Click Report again from loaded state. All three dropdowns must read "All" (no selection leakage from previous run — regression guard for F1 of `2026-04-14-surgical-fixes.md`).
5. **View Consolidated flow.** Search "disney" → check 3–5 Disney accounts → click View Consolidated → confirm modal → Start → consolidated view renders.
6. **Cross-dimension cache reuse.** With Report loaded for `customer` dimension, switch to `vendor`. Re-aggregation completes in <1 s and Network tab shows no Priority-API calls.
7. **Smoke-test the Alexandra → 70-rep scenario** from `2026-04-14-surgical-fixes.md` Test R1 — verifies the prior fix still holds post-removal.
8. **Airtable Omni embed** at the production URL — behavior identical to non-embedded.

### Quality gates (from `CLAUDE.md`)
- No file exceeds 300 lines.
- Every surviving file retains its intent block.
- No `any` types introduced (`grep -rn ": any\|as any" server/src/ client/src/`).
- No hardcoded colors.
- No Priority writes.

---

## Out of scope (follow-ups, tracked separately)

- **Hydration path for `report_payload` cache** (formerly `report2_payload`) — still write-only per H6 of the adversarial review. Real iframe-reload resilience needs a read path; not addressed here.
- **Per-customer toggle rollout to all 7 modal cards** — tracked in the v2 design doc.

---

## Files that will be touched

**Deleted (6 client files):** `AllEntityEntry.tsx`, `FetchAllDialog.tsx`, `FetchAllProgress.tsx`, `useFetchAll.ts`, `select-display-dashboard.ts`, `select-display-dashboard.test.ts`.

**Renamed (7 client files):** `useReport2.ts`, `useConsolidated2.ts`, `Report2Button.tsx`, `ViewConsolidated2Button.tsx`, `Report2FilterModal.tsx`, `Report2ProgressModal.tsx`, `Consolidated2ConfirmModal.tsx`.

**Modified (commit 1 — client):** `useEntitySelection.ts`, `useDashboardData.ts`, `useDashboardState.ts`, `SelectionBar.tsx`, `EntityList.tsx`, `LeftPanel.tsx`, `DashboardLayout.tsx`, `dashboard-layout-types.ts`.

**Modified (commit 1 — shared):** `shared/types/dashboard.ts`.

**Modified (commit 2 — server):** `server/src/cache/cache-keys.ts` (one string literal).

**Modified (commit 2 — client):** every file that imports a renamed symbol (rough estimate: 12–18 files, all mechanical).

**Total estimate:** ~25 files across two commits. Commit 1 is the bulk of the diff; commit 2 is mostly `git mv` + find-and-replace.

---

## Next step

Invoke `/writing-plans` to produce the step-by-step implementation plan derived from this spec.
