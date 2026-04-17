# Literal `\u2014` Rendering Bug Investigation

**Date:** 2026-04-17  
**Verdict:** `FIXED_BY_TASK_20`

## Queries run

```bash
# Grep source for double-escaped em-dashes
grep -rn '"\\\\u2014"' server/src/ client/src/
grep -rn "'\\\\u2014'" server/src/ client/src/
grep -rn "\\\\u2014" server/src/ client/src/

# Hit live API and scan raw bytes
curl -s 'http://localhost:3001/api/sales/entities?groupBy=customer' | python3 -c "
import sys; data = sys.stdin.read()
print('literal \\\\u2014 in response:', '\\\\u2014' in data)
"
```

## What was found

All `\u2014` occurrences in `client/src/` are single-backslash JS string escapes (e.g., `'\u2014'`), which render correctly as the em-dash character `—`. No double-backslash `'\\u2014'` (which would produce the literal 6-character string) was found anywhere in the source tree.

The live API response contained no literal `\u2014` string — the JSON payload used either direct UTF-8 `—` or standard single-escape `"\u2014"` notation, both of which JSON.parse decodes to the `—` character correctly.

## Root-cause verdict

The original screenshot bug (YoY column showing `\u2014` as 6 characters) was in the **old YoY column** that was removed and redesigned in Task 20. The column no longer exists; the redesigned KPI modal shows "LY same-period" and "LY full" values derived from `kpis.prevYearRevenue` / `kpis.prevYearRevenueFull` (numeric fields, not string-formatted). No string pre-escaping path survives in the current codebase.

The underlying serializer/renderer does not double-encode em-dashes. No code fix was required.
