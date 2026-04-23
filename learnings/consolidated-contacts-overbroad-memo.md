# `useConsolidatedContacts` over-broad memo → 1876-ID fan-out

## Symptom

Clicking Report (not View Consolidated) on the customer dimension completed the fetch-all SSE successfully, then immediately issued `GET /api/sales/contacts?dimension=customer&entityIds=C2257,C2273,...<1876 IDs>` — a ~40 KB URL — that returned **500 Internal Server Error**. Server log showed `TypeError: fetch failed`. Root cause was Priority rate-limit overload: the contacts route fans out via `Promise.all(customerIds.map(id => fetchContacts(...)))` and 1876 parallel calls blew the 100 calls/min + 15-queued budget.

## Root Cause

In `client/src/hooks/useDashboardState.ts`, the memo feeding `useConsolidatedContacts` was scoped to the wrong signal:

```ts
// BUG — fires for ANY completed Report, including regular Report with all 1876 customers
const consolidatedContactIds = useMemo(() => {
  if (report.state === 'loaded' && report.payload) return report.payload.entities.map(e => e.id);
  return [];
}, [report.state, report.payload]);
```

Two distinct flows populate `report.payload.entities`:
- **Regular Report** (`report.open()` → modal → `startReport(filters)`) — `filters.entityIds` is **undefined**. Payload carries the full dimension (1876 customers). Contacts panel is NOT shown in this flow.
- **View Consolidated** (`startReport({ entityIds: selectedIds })`) — `filters.entityIds` is `['C001', ...]` (a handful). Payload is narrowed server-side to those IDs.

The memo ignored `filters.entityIds`, so both flows ended up enabling the contacts query with the full entity set.

## Fix

Scope the memo to the explicit request shape, not the response:

```ts
const consolidatedContactIds = useMemo(
  () => deriveConsolidatedContactIds({
    state: report.state, payload: report.payload, filters: report.filters,
  }),
  [report.state, report.payload, report.filters],
);

// derive-consolidated-contact-ids.ts:
export function deriveConsolidatedContactIds(report: {...}): string[] {
  if (report.state !== 'loaded' || !report.payload) return [];
  return report.filters.entityIds ?? [];
}
```

`filters.entityIds` is undefined on Regular Report → `[]` → hook stays disabled → zero contacts calls.

## Lesson

**Discriminator should match the request shape, not the response shape.** When two code paths both produce a "loaded" state but represent different user intents, key the decision on what was *asked for* (the request's filters), not what came back (the response's entities). The response reflects server-side assembly; the request reflects user intent.

**Over-broad `useMemo` deps are a load-bearing bug.** A memo that reads `payload` but not `filters` misses the discriminator. TanStack Query's `enabled` check then fires a query for data the user never asked about, and the downstream cost (40 KB URL, 1876 parallel server calls, rate-limit overload) is invisible at the call site.

## Defense-in-Depth Still Open

- Client: `useConsolidatedContacts` doesn't cap `entityIds.length` or switch to POST. A future caller passing 500+ IDs would still blow URL limits.
- Server: `contacts.ts` multi-customer path does `Promise.all(customerIds.map(fetchContacts))` without concurrency limits. Should batch (e.g., 10 at a time with throttle) or reject over N.

Both are follow-ups, not part of this fix.
