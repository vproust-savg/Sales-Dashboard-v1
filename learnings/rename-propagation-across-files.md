# Renaming a Shared Type Field Across Server + Client

## The Scenario

Renaming `productMix` (singular) to `productMixes` (plural, with a type change from array to Record) in `DashboardPayload` required updates in 7 files across server and client.

## The Process

### 1. Grep before changing anything

```bash
grep -rn "productMix" shared/ server/ client/
```

This gives you the full blast radius before you touch a single file.

### 2. Change the source of truth first

Update the shared type definition (`shared/types/dashboard.ts`). This makes `tsc` fail everywhere the old name is used — the compiler becomes your checklist.

### 3. Fix server, then client

Server files reference the type in aggregation logic. Client files reference it in props, destructuring, and JSX. Fix them in dependency order:
1. `shared/types/dashboard.ts` — the type
2. `server/src/services/data-aggregator.ts` — produces the data
3. `server/tests/` — test assertions
4. `client/src/mock-data.ts` — mock shape
5. `client/src/components/right-panel/ChartsRow.tsx` — consumes the data
6. `client/src/components/right-panel/RightPanel.tsx` — passes the prop
7. `client/src/layouts/DashboardLayout.tsx` — passes the prop

### 4. Check for spread patterns

If the server route uses `...aggregated` spread (rather than explicit `productMix: aggregated.productMix`), the rename propagates automatically through the spread. No route change needed. Verify this with grep.

### 5. Check comments and strings

```bash
grep -rn "productMix\|TopTenBestSellers" client/src/ --include="*.ts" --include="*.tsx"
```

Stale references in `USED BY` comments, string literals, and `title` attributes won't cause type errors but create confusion.

### 6. Run tsc after all changes

```bash
cd client && npx tsc -b --noEmit
cd ../server && npx tsc --noEmit
```

Zero errors = complete propagation.

## Key Insight

TypeScript strict mode is your best friend for renames. Change the type first, then let the compiler errors guide you through every file that needs updating. The only things it won't catch are comments and string literals — grep for those separately.

## Discovered

2026-03-31 — renaming productMix → productMixes across 7 files in shared/server/client
