# Plan C Integration Lessons

## Framer Motion + prefers-reduced-motion
CSS `@media (prefers-reduced-motion: reduce)` does NOT affect Framer Motion animations.
Framer Motion drives animations via JavaScript (RAF-based springs/tweens).
**Fix:** Use `<MotionConfig reducedMotion="user">` at app root to respect OS setting.

## AnimatedNumber spring tuning
Default `{ stiffness: 100, damping: 20 }` settles in >1s for large numeric values (e.g., $450K).
For KPI counter animation targeting ~350ms, use `{ stiffness: 400, damping: 40 }`.

## ARIA listbox/option tree
`motion.div` wrappers between a `role="listbox"` and `role="option"` elements break
the ARIA ownership model. Screen readers won't recognize options as belonging to the listbox.
**Fix:** Apply motion props directly on the `role="option"` element.

## Priority ERP error key
The key is `"odata.error"` (with a dot in the key name), NOT `obj.error`.
Must use bracket notation: `obj['odata.error']`.
Also, the message is nested: `odata.error.message.value`, not `.message` directly.

## Docker __dirname path math
With `rootDir: ".."` in tsconfig, compiled output preserves directory structure:
`server/src/index.ts` → `server/dist/server/src/index.js`
So `__dirname` = `/app/server/dist/server/src/` in Docker.
Path to client: `../../../../client/dist` (4 levels up to reach /app/).

## Consolidated view aggregation
Must use weighted average for avgOrder: `totalRevenue / totalOrders`.
NOT simple average of per-entity averages. The utility can exist but must be
actually called from useDashboardState when isConsolidated is true.

## sortActive default comparison
Default sort is `revenue desc`. The comparison must check `desc` not `asc`:
`sortField !== 'revenue' || sortDirection !== 'desc'`
