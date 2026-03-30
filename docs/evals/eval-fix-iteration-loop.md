# Eval-Fix Iteration Loop

**Purpose:** After implementation completes, run the full eval, fix failures, and re-evaluate — max 3 iterations. This is the **outer loop** that wraps around the implementation phase.

**Referenced by:** Each plan's eval doc (`plan-a-backend-eval.md`, `plan-b-frontend-eval.md`, `plan-c-integration-eval.md`)

---

## 1. Loop Protocol

### Phase 0: Implementation (unchanged)

The orchestrating agent uses `/subagent-driven-development` to implement all tasks. Inline review checkpoints (`/requesting-code-review`, `/design-critique`) fire during implementation as specified in the eval doc. These are the **inner loop** — they catch issues while context is fresh.

The outer loop begins only after:
1. All tasks are marked complete in TodoWrite
2. The Pre-Completion Gate passes (Quick Smoke Test output pasted with all OK/PASS)

### Phase 1: Full Eval Run (Iteration 1)

1. **Run the Quick Smoke Test.** Capture output verbatim.
2. **Walk every eval section** in order. For each check, execute the verification command and record PASS or FAIL with the actual output.
3. **Produce Iteration Report 1** (format in Section 4 below).
4. **Apply convergence criteria** (Section 3 below):
   - CONVERGED → proceed to `/finishing-a-development-branch`
   - NEEDS_FIX → proceed to Phase 2

### Phase 2: Fix Agent Dispatch (Iterations 2 and 3)

1. **Extract failures** from the Iteration Report. Group by eval section.
2. **Identify regression surface:** checks that PASSED but share files with failing checks.
3. **Dispatch a fresh fix subagent** using the prompt template (Section 2 below). Provide:
   - Only the failing checks (not the full eval)
   - Relevant spec sections (from the eval doc's "Fix agent spec sections")
   - Allowed file scope (from the eval doc's "Fix agent file scope")
   - The regression surface checks to re-verify
4. **Fix agent works** following `/receiving-code-review` principles:
   - Verifies each failure independently (does not trust the report blindly)
   - Identifies root causes
   - Fixes one issue at a time, tests each fix
   - Reports what was fixed and what was not
5. **Re-run only failing checks + regression surface.** Passing checks from previous iterations carry forward.
6. **Produce Iteration Report N+1.**
7. **Apply convergence criteria:**
   - CONVERGED → proceed to `/finishing-a-development-branch`
   - NEEDS_FIX and iteration < 3 → repeat Phase 2
   - NEEDS_FIX and iteration = 3 → proceed to Phase 3

### Phase 3: Escalation

If iteration 3 still fails convergence:

1. Produce a final summary showing all 3 Iteration Reports.
2. List remaining failures with: check ID, how many times it failed, what was attempted, fix agent's assessment of why it cannot pass.
3. Ask the user for direction:
   - **(a)** Accept with documented exceptions
   - **(b)** Provide specific fix guidance
   - **(c)** Adjust eval criteria

**Never run iteration 4.** The 3-iteration cap prevents infinite loops.

---

## 2. Fix Agent Prompt Template

Dispatch as a fresh subagent (Agent tool, `subagent_type: "general-purpose"`). The fix agent gets focused context — only failures, not the full eval.

```
You are a fix agent for the Sales Dashboard project. Your job is to fix
evaluation failures from the post-implementation eval run.

## Your Rules

1. Follow /receiving-code-review principles:
   - Verify each failure independently before fixing (the report may have false positives)
   - No performative agreement — just state the fix or push back with reasoning
   - Fix one issue at a time, test each fix
2. Follow /verification-before-completion:
   - After each fix, run the specific verification command from the check
   - Do not claim a fix without pasting evidence (command + output)
3. Do NOT introduce new features, refactors, or improvements beyond what is
   needed to make the failing checks pass.
4. If a fix would require changing the API contract, architecture, or scope:
   STOP and report BLOCKED with explanation.

## Project Context

- Spec: docs/specs/2026-03-29-sales-dashboard-design.md (Sections: {SPEC_SECTIONS})
- Eval doc: {EVAL_DOC_PATH}
- CLAUDE.md conventions apply (intent blocks, 200-line limit, no any, etc.)

## File Scope

You may ONLY modify files in: {ALLOWED_FILE_PATHS}
You may READ but not modify: {READ_ONLY_PATHS}

## Failing Checks (Iteration {N})

{FOR EACH FAILING CHECK:}

### Check {SECTION}.{NUMBER}: {DESCRIPTION}
**Weight:** {Critical/High/Medium}
**Verification command:**
{EXACT_COMMAND_FROM_EVAL_DOC}
**Previous output (why it failed):**
{ACTUAL_OUTPUT}
**Relevant files:** {FILES}

## Regression Surface

After fixing, re-verify these checks (they passed but share files with your fixes):
{LIST_OF_REGRESSION_CHECKS}

## Report Format

FIX REPORT — Iteration {N+1}
=============================
FIXED:
- Check {X.Y}: {what was wrong} → {what changed} → {verification output}

NOT FIXED:
- Check {X.Y}: {root cause analysis, what was attempted, why it cannot pass}

REGRESSION CHECK:
- Check {X.Y}: Still PASS / REGRESSED → {details}

FILES MODIFIED:
- {file path}: {brief description of change}
```

### How to populate the template

The orchestrating agent fills the template from the Iteration Report:

1. Extract all FAIL checks from the report.
2. For each, look up the verification command and relevant files from the eval doc.
3. Look up the spec sections from the eval doc's "Fix agent spec sections."
4. Compute regression surface: checks that PASSED but share files with failing checks.
5. Fill template, dispatch fresh subagent.

---

## 3. Convergence Criteria

### Per-Check

Binary: PASS or FAIL. No partial credit.

### Per-Section

Each section's verdict rule is defined in the eval doc (e.g., "PASS if 6/6 checks succeed"). These rules are unchanged.

### Overall Convergence

A plan's eval **converges** when:

1. **All Critical-weight sections PASS.**
2. **High-weight sections have at most 1 FAIL total** (across all High sections combined), and that FAIL has a documented fix plan stating what and when.
3. **Medium-weight sections are advisory.** FAIL does not block convergence.

This matches the existing "Ship readiness" rule in each eval doc.

### Decision Table

| Critical sections | High FAIL count | Result |
|-------------------|----------------|--------|
| All PASS | 0 | CONVERGED |
| All PASS | 1 (with fix plan) | CONVERGED |
| All PASS | 2+ | NEEDS_FIX |
| Any FAIL | any | NEEDS_FIX |
| Any FAIL (iteration 3) | any | ESCALATE |

---

## 4. Iteration Report Format

Append this structured block to the bottom of the eval doc after each iteration.

```markdown
---

## Iteration Report — Iteration {N}

**Timestamp:** {ISO 8601}
**Trigger:** {Initial eval / Re-run after fix agent iteration {N-1}}
**Scope:** {Full eval (all checks) / Failing checks from iteration {N-1} + regression surface}

### Smoke Test Output

​```
{Verbatim output of Quick Smoke Test script}
​```

### Section Results

| Section | Weight | Checks Run | Passed | Failed | Verdict |
|---------|--------|------------|--------|--------|---------|
| 1. {name} | Critical | {N} | {N} | {N} | PASS/FAIL |
| 2. {name} | Critical | {N} | {N} | {N} | PASS/FAIL |
| ... | | | | | |

For iterations 2+, include a "Carried Forward" column for checks not re-run:

| Section | Weight | Re-run | Carried Fwd | Newly Passed | Still Failed | Verdict |
|---------|--------|--------|-------------|--------------|--------------|---------|

### Failing Checks Detail

| Check | Section | Weight | Failure Detail |
|-------|---------|--------|----------------|
| {1.3} | {name} | Critical | {brief description + output} |

### Convergence Assessment

- Critical sections: {all PASS / N FAIL}
- High sections: {N FAIL total, max 1 allowed}
- **Result:** CONVERGED / NEEDS_FIX / ESCALATE
```

---

## 5. Diminishing Scope

Each iteration re-runs less than the previous one:

| Iteration | What runs | Why |
|-----------|-----------|-----|
| 1 | ALL checks (full eval) | Baseline — need complete picture |
| 2 | Only checks that FAILED in iteration 1 + regression surface | Passing checks carry forward — no point re-verifying |
| 3 | Only checks that FAILED in iteration 2 + regression surface | Even narrower — focused on remaining issues |

**Regression surface** = checks that PASSED but operate on files that the fix agent modified. These are re-run to catch regressions introduced by fixes.

**Carry-forward rule:** A check that passed in a previous iteration and is NOT in the regression surface retains its PASS status without re-running.

---

## 6. Integration with Existing Workflow

```
/subagent-driven-development
    │
    ├── Inner loop: inline review checkpoints
    │   (/requesting-code-review, /design-critique at task milestones)
    │
    ▼
All tasks complete + Pre-Completion Gate passes
    │
    ▼
THIS PROTOCOL: Eval-Fix Iteration Loop (max 3 iterations)
    │
    ▼
/finishing-a-development-branch
```

**Relationship to inner loop:** The inline review checkpoints catch issues during implementation. If they work well, the outer loop should mostly pass on iteration 1. The outer loop is a safety net for cross-task integration issues, performance problems, deployment readiness, and anything the inline reviews missed.

**Relationship to loop detection:** The existing "Loop Detection" section in each eval doc (same file edited 5x, same check fails 3x) applies WITHIN the outer loop. If loop detection triggers during a fix agent's work, that check is marked NOT_FIXED and included in the escalation report.
