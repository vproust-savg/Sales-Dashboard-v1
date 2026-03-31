# Carousel Wrap-Around with Modular Arithmetic

## The Pattern

For a circular carousel (last → first, first → last), use modular arithmetic instead of bounds checking:

```typescript
const count = PRODUCT_MIX_ORDER.length; // 5 items

const goPrev = () => setActiveIdx(i => (i - 1 + count) % count);
const goNext = () => setActiveIdx(i => (i + 1) % count);
```

The `+ count` before `% count` handles the negative case: when `i = 0`, `(0 - 1 + 5) % 5 = 4` (wraps to last).

## Keyboard Navigation

Add `onKeyDown` on the carousel container with `tabIndex={0}`:

```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
  if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
};
```

## ARIA for Carousel Tabs

```tsx
<div role="tablist" aria-label="Product Mix categories">
  {items.map((item, idx) => (
    <button
      key={item}
      role="tab"
      aria-selected={idx === activeIdx}
      onClick={() => setActiveIdx(idx)}
    />
  ))}
</div>
```

## Direction-Aware Transitions

Track direction for Framer Motion slide animations:

```typescript
const [direction, setDirection] = useState(0);

const goPrev = () => { setDirection(-1); setActiveIdx(i => (i - 1 + count) % count); };
const goNext = () => { setDirection(1);  setActiveIdx(i => (i + 1) % count); };

// Key the AnimatePresence by activeIdx so it unmounts/mounts on change
<AnimatePresence mode="wait" custom={direction}>
  <motion.div
    key={activeIdx}
    initial={{ opacity: 0, x: direction > 0 ? 40 : -40 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: direction > 0 ? -40 : 40 }}
  />
</AnimatePresence>
```

## Dot Indicators

Small circles showing position — active dot uses accent color, inactive uses subtle:

```tsx
<div className="flex gap-[var(--spacing-sm)]">
  {items.map((_, idx) => (
    <button
      key={idx}
      className={`h-1.5 w-1.5 rounded-full transition-colors ${
        idx === activeIdx ? 'bg-[var(--color-gold-primary)]' : 'bg-[var(--color-gold-subtle)]'
      }`}
      onClick={() => setActiveIdx(idx)}
    />
  ))}
</div>
```

## Discovered

2026-03-31 — Product Mix carousel (5 donut chart types with wrap-around navigation)
