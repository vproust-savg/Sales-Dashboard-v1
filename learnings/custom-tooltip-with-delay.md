# Custom Tooltip with Hover Delay (Replacing Native `title`)

## Why Replace Native `title`

The native `title` attribute tooltip:
- Has inconsistent delay across browsers (~400-800ms)
- Cannot be styled (always system chrome appearance)
- Disappears immediately on mouse move
- No animation support

## The Pattern

A reusable `<Tooltip>` wrapper with 200ms hover delay, Framer Motion fade, and dark background:

```typescript
export function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), 200);
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setVisible(false);
  }, []);

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-full left-0 z-50 mt-1 ..."
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

## Key Details

- **`useRef` for timeout** — not `useState`. The timer ID doesn't need to trigger re-renders, and `clearTimeout` needs the current value synchronously.
- **`ReturnType<typeof setTimeout>`** — TypeScript-safe timer type that works in both Node and browser environments (avoids `NodeJS.Timeout` vs `number` conflict).
- **200ms delay** — enough to prevent flashing on mouse pass-through, short enough to feel responsive.
- **`position: absolute; top: full`** — tooltip appears below the trigger element. Parent needs `position: relative`.
- **Dark background** — `var(--color-dark)` with white text at 12px for high contrast and readability.

## Gotcha: Cleanup on Unmount

If the component unmounts while the timer is pending, the `setTimeout` callback will try to `setVisible(true)` on an unmounted component. React 19 handles this gracefully (no warning), but for robustness add cleanup:

```typescript
useEffect(() => {
  return () => { if (timerRef.current) clearTimeout(timerRef.current); };
}, []);
```

## Discovered

2026-03-31 — replacing native title on Best Sellers truncated product names
