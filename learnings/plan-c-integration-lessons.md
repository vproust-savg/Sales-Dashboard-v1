# Plan C Integration Lessons

What went wrong, what was missing from each document, and how to prevent it next time.

## Summary

8 bugs found across 3 review checkpoints. Root cause pattern: **cross-boundary integration failures** — each task was correct in isolation but the connections between them were never specified. The spec describes *what*, the plan describes *which files*, but neither describes *how the pieces connect*.

---

## Bugs Found and Document Gaps

### Bug 1: `aggregateForConsolidated` created but never called

**What happened:** Task 5 created `client/src/utils/aggregation.ts` with a correct weighted-average implementation. But `useDashboardState` (Task 3) never imported or called it. The consolidated view silently showed stale single-entity data.

**Missing from spec (Section 10.5):** Described the math (weighted avg order = totalRevenue / totalOrders) but not *where* the calculation triggers. Should have said: "useDashboardState MUST call aggregateForConsolidated when isConsolidated is true and selectedIds.length > 0."

**Missing from plan (Task 5):** Only said "Create: `client/src/utils/aggregation.ts`". Should have included a wiring step: "Import aggregateForConsolidated in useDashboardState.ts and apply when isConsolidated is true."

**Missing from plan (Task 3):** The useDashboardState code template (lines 416-507 of Plan C) had no mention of aggregation. The return value just spread `processedEntities` without considering consolidated state.

**Missing from eval:** No check for "Is every exported utility actually imported somewhere?" A simple `grep` for unused exports would have caught this.

---

### Bug 2: `sortActive` compared against 'asc' instead of 'desc'

**What happened:** `useSort` defaults to `{ field: 'revenue', direction: 'desc' }`. DashboardLayout checked `sortDirection !== 'asc'`, which is always true since the default is `'desc'`. The sort badge appeared permanently active.

**Missing from spec (Section 15.4):** Did not state the default sort values explicitly. The sort behavior was described ("Revenue high-to-low by default") but the code-level default values were implied.

**Missing from plan (Task 6):** The DashboardLayout wiring step didn't define the `sortActive` derivation. It was left to the implementing agent to infer.

**Lesson:** When a derived boolean depends on matching a default value in another file, both the default and the derivation must be specified in the same place or cross-referenced.

---

### Bug 3: AND/OR conjunction toggle was cosmetic only

**What happened:** FilterPanel maintained `conjunction` as local React state via `useState`. The filter engine (`filterEntities`) always used `.every()` (AND logic). Toggling AND/OR in the UI had zero effect on actual filtering.

**Missing from spec (Section 13.3):** Described that "conditions can use AND or OR conjunction" but didn't specify the data flow: UI toggle → condition state → filter engine evaluation.

**Missing from plan (Task 2 + Task 4):** These were independent tasks. Task 2 created `useFilters` with a `conjunction` field on each condition (hardcoded to `'and'`). Task 4 created `filter-engine.ts` with `.every()`. Neither task referenced the other. No "integration contract" specified that the engine must read the conjunction field.

**Missing from eval:** No check verifying that toggling AND/OR actually changes the filtered results. The eval checked "Filter adds condition, list count decreases" but not "AND/OR toggle changes filter behavior."

---

### Bug 4: Priority error key `"odata.error"` parsed as `obj.error`

**What happened:** `extractPriorityError` checked `obj.error` but the actual JSON key is `"odata.error"` (dot in the key name). JavaScript `obj.error` does not match `obj["odata.error"]`. Additionally, the message is nested (`message.value`), not a direct string.

**CLAUDE.md was correct:** The format was documented as `{ "odata.error": { "message": { "value": "..." } } }`. The implementing agent simply didn't follow it.

**Missing from eval (Plan A):** No test that mocks a real Priority error response and verifies the parsed message matches. The priority-client tests mock `fetch` but don't test the specific `"odata.error"` key format.

**Lesson:** When a documented format has a non-obvious gotcha (dot in key name), the CLAUDE.md note should call it out explicitly with "use bracket notation" rather than just showing the JSON structure.

---

### Bug 5: CSS `prefers-reduced-motion` doesn't suppress Framer Motion

**What happened:** `index.css` added `@media (prefers-reduced-motion: reduce)` with `animation-duration: 0.01ms !important`. This kills CSS animations (skeleton shimmer, Tailwind transitions) but has zero effect on Framer Motion, which drives animations via JavaScript (requestAnimationFrame springs/tweens).

**Missing from spec (Section 12.3):** Said "disable animations" but didn't distinguish CSS animations from JS-driven Framer Motion. The spec should have noted: "Framer Motion requires `<MotionConfig reducedMotion='user'>` — CSS media queries don't affect it."

**Missing from plan (Task 8):** Step 1 only mentioned the CSS media query. Should have included: "Also add `<MotionConfig reducedMotion='user'>` at App root to suppress Framer Motion animations."

**Missing from eval (Section 5):** Check 4.7 said "prefers-reduced-motion: reduce disables all animations (instant)" but the verification method was visual-only. Should have specified: "Verify no `motion.*` element animates when OS-level reduced motion is enabled."

---

### Bug 6: AnimatedNumber spring settles in ~1.5s, not ~350ms

**What happened:** Spring config `{ stiffness: 100, damping: 20, mass: 0.5 }` was tuned for small positional values (pixels). For KPI values spanning hundreds of thousands (e.g., $450,000), the spring takes >1 second to settle because the numeric distance is enormous.

**Missing from spec (Section 21.3):** Said "~350ms" but didn't specify spring parameters for large value ranges. The spec assumed the implementing agent would understand spring physics.

**Missing from plan (Task 7, AnimatedNumber):** The code template used Plan B's existing spring config without adjusting for actual KPI magnitudes.

**Lesson:** Animation timing specs should include either exact parameters (`{ stiffness: 400, damping: 40 }`) or test criteria ("verify settle time with a value of $500,000").

---

### Bug 7: `motion.div` wrappers broke ARIA listbox/option tree

**What happened:** Task 7 added stagger animation by wrapping each `EntityListItem` in a `<motion.div>`. This created: `<div role="listbox">` → `<motion.div>` → `<div role="option">`. Per ARIA 1.2 §3.15, `listbox` children must be `option` (direct or within `group`). The intervening wrapper broke screen reader ownership.

**Missing from plan (Task 7):** No warning about ARIA regression risk. Adding animation wrappers to semantic elements is a known a11y hazard. The task should have said: "WARNING: Do not add wrapper elements between ARIA parent/child pairs. Apply motion props directly on the `role='option'` element."

**Missing from spec (Section 9):** Accessibility requirements listed roles and keyboard nav, but didn't mention the DOM structure constraint for ARIA ownership.

**Missing from eval (Section 5):** No check for "DOM structure of listbox/option is valid (no intervening wrappers)." The eval checked roles exist but not the parent-child relationship.

---

### Bug 8: `aria-selected` reflected active entity, not multi-select state

**What happened:** Plan B set `aria-selected={isActive}` on `EntityListItem`. This meant the active entity (shown in right panel) was "selected" in ARIA, but multi-selected checkboxes were not. In a `listbox` with `aria-multiselectable="true"`, `aria-selected` should reflect the checkbox state, not the focused/active item.

**Missing from spec (Section 9):** Listed `aria-selected` as required but didn't specify which state it maps to. Should have said: "In multi-select mode, `aria-selected` reflects checkbox state. Use `aria-current` for the active/focused entity."

**Missing from Plan B (Task 6, EntityListItem):** Code template set `aria-selected={isActive}` without considering the multi-select interaction model.

**Missing from eval (Plan B, Section 5):** Check said "items have `role='option'`" but didn't verify "`aria-selected` matches checkbox state in multi-select mode."

---

## Additional Issues (not bugs, but gaps)

### 200-line violations carried from Plan A

`data-aggregator.ts` (279 lines) and `priority-client.ts` (208 lines) were created during Plan A. The Plan A eval has a code quality section checking `<200 lines/file`, but the previous build agent never ran the eval-fix loop.

**Missing from plan (Plan A):** No per-task file length check. Each task should end with `wc -l` verification.

### `.js` files committed alongside `.ts` source

The previous build agent ran `tsc` and the compiled output landed in the source directories (not `dist/`). 104 files were committed including `.js` duplicates of every `.ts` file.

**Missing from CLAUDE.md:** No rule about build artifacts in source directories. Now added.

### PeriodSelector "More" dropdown is keyboard-inaccessible

The dropdown relies on CSS `:hover` with no `onFocus`, `aria-haspopup`, or `aria-expanded`. Keyboard users cannot access years beyond the first three.

**Missing from spec (Section 22.3):** Described "More ▾" dropdown visually but didn't specify keyboard interaction.

**Missing from eval (Section 5):** No check for "All interactive elements are keyboard-accessible, including dropdowns."

### ContactsTable uses `contact.email` as React key

Contacts with empty or duplicate emails cause React duplicate-key warnings and missing rows.

**Missing from plan (Plan B, Task 16):** Code template didn't consider empty/duplicate keys.

---

## Recommendations for Future Specs

1. **Add "Integration Contract" to every cross-file feature.** When a utility is created in one task and consumed in another, both tasks must reference each other with import paths and function names.

2. **Distinguish CSS animations from JS animations.** Any spec mentioning `prefers-reduced-motion` must specify both the CSS rule AND the Framer Motion `MotionConfig` approach.

3. **Specify default values once, reference everywhere.** If the default sort is `revenue desc`, state it in one canonical location and require all derived checks to reference that location.

4. **State flow diagrams for stateful features.** For any feature where UI state affects behavior (filters, sort, consolidated view), document the full path: UI control → hook state → consumer function.

5. **ARIA checks must verify semantics, not just existence.** "Has `aria-selected`" is insufficient. The check must be "`aria-selected` reflects the correct state for the interaction model."

6. **Animation specs should include test parameters.** "~350ms" is ambiguous for spring physics. Specify either exact parameters or test criteria with representative values.

7. **Every task should end with a verification step.** `wc -l` for line counts, `grep` for unused exports, `tsc --noEmit` for type safety. Don't defer verification to the eval-fix loop.

## Recommendations for Future Plans

1. **Cross-task dependency table.** Each task should list "imports from tasks" and "imported by tasks."

2. **Wiring tasks should reference all dependencies.** Task 6 ("Wire components") should have listed every utility from Tasks 0-5 that needs to be imported, not just "wire all components."

3. **Flag accessibility regression risks.** Any task that modifies DOM structure (adding wrappers, reordering elements) should note which ARIA relationships might break.

4. **Include a "dead export" check.** After implementation, run `grep` to verify every exported function is imported somewhere.

5. **Plan-level smoke tests.** Each batch should have a mini-verification before moving to the next batch. The eval-fix loop catches issues too late.

## Recommendations for Future Evals

1. **Add "cross-task wiring" section.** Checks like "Is every exported utility imported somewhere?" and "Does every state change propagate to its consumer?"

2. **Semantic ARIA checks.** Not just "has `role='listbox'`" but "listbox children are direct `role='option'` elements without intervening wrappers."

3. **Animation timing checks.** "KPI counter settles within 500ms for values up to $1M" — testable with browser DevTools.

4. **Keyboard accessibility sweep.** "Every interactive element is reachable via Tab and operable via Enter/Space/Escape."

5. **Unused export detection.** "Run `grep -r 'export function' client/src/ | while read line; do ... done` to find exports with no consumers."
