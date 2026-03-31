# Overlapping Pagination (Shift by N, Show M)

## The Pattern

Standard pagination shows non-overlapping pages (1-10, 11-20, 21-30). Overlapping pagination shifts by fewer items than it shows, creating a sliding window effect:

```
PAGE_STEP = 5     // shift by 5
VISIBLE_COUNT = 10 // show 10 at a time

Page 1: items  1-10
Page 2: items  6-15   ← overlaps with page 1
Page 3: items 11-20
Page 4: items 16-25
```

## Implementation

```typescript
const PAGE_STEP = 5;
const VISIBLE_COUNT = 10;

const [startIdx, setStartIdx] = useState(0);

const canPrev = startIdx > 0;
const canNext = startIdx + VISIBLE_COUNT < filtered.length;

const visible = filtered.slice(startIdx, startIdx + VISIBLE_COUNT);
const pageLabel = `${startIdx + 1}\u2013${Math.min(startIdx + VISIBLE_COUNT, filtered.length)} of ${filtered.length}`;

// Navigation
const prev = () => setStartIdx(i => Math.max(0, i - PAGE_STEP));
const next = () => setStartIdx(i => Math.min(i + PAGE_STEP, filtered.length - VISIBLE_COUNT));
```

## Why Overlapping

- **Context continuity** — user sees 5 familiar items + 5 new items when paging forward
- **Smoother browsing** — less jarring than a complete content swap
- **Good for ranked lists** — best sellers, leaderboards, where relative position matters

## Direction-Aware Animation

Track shift direction for Framer Motion slide transitions:

```typescript
const [direction, setDirection] = useState(0);

const prev = () => { setDirection(-1); setStartIdx(i => Math.max(0, i - PAGE_STEP)); };
const next = () => { setDirection(1);  setStartIdx(i => Math.min(...)); };

// AnimatePresence mode="wait"
<motion.div
  key={startIdx}
  initial={{ opacity: 0, x: direction > 0 ? 30 : -30 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: direction > 0 ? -30 : 30 }}
/>
```

## Discovered

2026-03-31 — Best Sellers pagination (25 items, shift by 5, show 10)
