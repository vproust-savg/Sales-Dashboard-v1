# Nested Detail Panel Styling — Less Is More

## Context
When designing expandable/nested detail panels (e.g., order line items inside an order row), we iterated through several approaches before landing on the right one.

## What Failed
1. **3px gold-primary left border** — too heavy, draws attention to the line instead of the data
2. **Tinted background (gold-hover)** — user didn't want any background color difference
3. **White card with shadow + border-radius** — felt like a separate card, not a subordinate detail
4. **Flush-left (no indent)** — lost the nesting hierarchy

## What Works
- **1.5px left border** in `gold-muted` (#e8e0d0) — whisper-thin, not attention-grabbing
- **Left indent** (`ml-[var(--spacing-3xl)]`) — creates visual nesting under the parent row
- **No background color** — transparent, inherits from parent
- **No border-radius, no shadow, no surrounding border**
- **Smaller vertical margin** (`my-[var(--spacing-sm)]`) — tight to parent row

## The Principle
For nested/subordinate UI panels, use the **minimum visual treatment** needed to show hierarchy. The indent alone does most of the work. A thin muted line reinforces it. Anything more (backgrounds, shadows, heavy borders) competes with the data.

## Applies To
- Order line items (`OrderLineItems.tsx`)
- Any future expandable detail rows in tables
- Sub-content panels that should feel subordinate, not prominent
