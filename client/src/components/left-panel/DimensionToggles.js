import { jsx as _jsx } from "react/jsx-runtime";
// FILE: client/src/components/left-panel/DimensionToggles.tsx
// PURPOSE: 2x3 grid of pill buttons for switching between 6 entity dimensions
// USED BY: client/src/components/left-panel/LeftPanel.tsx
// EXPORTS: DimensionToggles
import { useCallback, useRef } from 'react';
/** WHY: ordered array keeps render order stable and enables keyboard nav by index */
const DIMENSIONS = [
    { key: 'customer', label: 'Customers' },
    { key: 'zone', label: 'Zone' },
    { key: 'vendor', label: 'Vendors' },
    { key: 'brand', label: 'Brands' },
    { key: 'product_type', label: 'Prod. Type' },
    { key: 'product', label: 'Products' },
];
export function DimensionToggles({ activeDimension, onDimensionChange }) {
    const containerRef = useRef(null);
    /** WHY: keyboard nav per WAI-ARIA tablist pattern — arrow keys cycle through tabs */
    const handleKeyDown = useCallback((event) => {
        const currentIndex = DIMENSIONS.findIndex(d => d.key === activeDimension);
        let nextIndex = currentIndex;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            nextIndex = (currentIndex + 1) % DIMENSIONS.length;
        }
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            nextIndex = (currentIndex - 1 + DIMENSIONS.length) % DIMENSIONS.length;
        }
        else {
            return;
        }
        onDimensionChange(DIMENSIONS[nextIndex].key);
        /** WHY: after state change, focus the newly-active tab button */
        const buttons = containerRef.current?.querySelectorAll('[role="tab"]');
        buttons?.[nextIndex]?.focus();
    }, [activeDimension, onDimensionChange]);
    return (_jsx("div", { ref: containerRef, role: "tablist", "aria-label": "Data dimension", onKeyDown: handleKeyDown, className: "grid grid-cols-3 grid-rows-2 gap-[5px] rounded-[var(--radius-2xl)] bg-[var(--color-bg-card)] p-[var(--spacing-sm)] shadow-[var(--shadow-card)]", children: DIMENSIONS.map(({ key, label }) => {
            const isActive = key === activeDimension;
            return (_jsx("button", { role: "tab", "aria-selected": isActive, tabIndex: isActive ? 0 : -1, onClick: () => onDimensionChange(key), className: `
              flex h-[31px] items-center justify-center rounded-[var(--radius-lg)]
              px-[var(--spacing-sm)] py-[var(--spacing-md)] text-[12px] leading-none
              transition-colors duration-150
              ${isActive
                    ? 'bg-[var(--color-dark)] font-semibold text-white shadow-[var(--shadow-active)]'
                    : 'bg-transparent font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-gold-hover)]'}
            `, children: label }, key));
        }) }));
}
