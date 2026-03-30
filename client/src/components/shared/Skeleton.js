import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Skeleton({ variant }) {
    if (variant === 'left-panel')
        return _jsx(LeftPanelSkeleton, {});
    if (variant === 'right-panel')
        return _jsx(RightPanelSkeleton, {});
    return _jsx(KPICardSkeleton, {});
}
/** Reusable shimmer block — uses the .skeleton CSS class from index.css */
function ShimmerBlock({ width, height, rounded = 4 }) {
    return (_jsx("div", { className: "skeleton", style: {
            width: typeof width === 'number' ? `${width}px` : width,
            height,
            borderRadius: rounded,
        } }));
}
/** Left panel: 6 dimension pills + search box + 8 entity rows (spec Section 8.3) */
function LeftPanelSkeleton() {
    return (_jsxs("div", { className: "flex flex-col gap-[var(--spacing-base)]", children: [_jsx("div", { className: "rounded-[var(--radius-2xl)] bg-[var(--color-bg-card)] p-[var(--spacing-sm)] shadow-[var(--shadow-card)]", children: _jsx("div", { className: "grid grid-cols-3 gap-[5px]", children: Array.from({ length: 6 }).map((_, i) => (_jsx(ShimmerBlock, { width: "100%", height: 32, rounded: 10 }, i))) }) }), _jsx("div", { className: "rounded-[var(--radius-xl)] bg-[var(--color-bg-card)] p-[var(--spacing-base)] shadow-[var(--shadow-card)]", children: _jsx(ShimmerBlock, { width: "100%", height: 20, rounded: 6 }) }), _jsxs("div", { className: "flex-1 rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-[var(--spacing-2xl)] shadow-[var(--shadow-card)]", children: [_jsx(ShimmerBlock, { width: "60%", height: 10, rounded: 3 }), _jsx("div", { className: "mt-[var(--spacing-lg)] flex flex-col gap-[var(--spacing-xl)]", children: Array.from({ length: 8 }).map((_, i) => (_jsx(EntityRowSkeleton, {}, i))) })] })] }));
}
/** Single entity row placeholder — name line (60%) + meta line (40%) */
function EntityRowSkeleton() {
    return (_jsxs("div", { className: "flex flex-col gap-[var(--spacing-xs)]", children: [_jsx(ShimmerBlock, { width: "60%", height: 12 }), _jsx(ShimmerBlock, { width: "40%", height: 10 })] }));
}
/** Right panel: header + KPI grid + chart area + tab area (spec Section 8.3) */
function RightPanelSkeleton() {
    return (_jsxs("div", { className: "flex flex-col gap-[var(--spacing-base)]", children: [_jsxs("div", { className: "rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-4xl)] py-[var(--spacing-xl)] shadow-[var(--shadow-card)]", children: [_jsx(ShimmerBlock, { width: "40%", height: 20, rounded: 6 }), _jsx("div", { className: "mt-[var(--spacing-md)]", children: _jsx(ShimmerBlock, { width: "70%", height: 11, rounded: 4 }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-[var(--spacing-base)]", children: [_jsxs("div", { className: "rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-[var(--spacing-3xl)] shadow-[var(--shadow-card)]", children: [_jsx(ShimmerBlock, { width: "50%", height: 10, rounded: 3 }), _jsx("div", { className: "mt-[var(--spacing-md)]", children: _jsx(ShimmerBlock, { width: "60%", height: 28, rounded: 6 }) }), _jsx("div", { className: "mt-[var(--spacing-lg)]", children: _jsx(ShimmerBlock, { width: "100%", height: 100, rounded: 4 }) })] }), _jsx("div", { className: "grid grid-cols-2 grid-rows-3 gap-[var(--spacing-md)]", children: Array.from({ length: 6 }).map((_, i) => (_jsx(KPICardSkeleton, {}, i))) })] }), _jsxs("div", { className: "grid grid-cols-[3fr_5fr] gap-[var(--spacing-lg)]", children: [_jsx("div", { className: "rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-[var(--spacing-3xl)] shadow-[var(--shadow-card)]", children: _jsx(ShimmerBlock, { width: "100%", height: 160, rounded: 80 }) }), _jsxs("div", { className: "rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-[var(--spacing-3xl)] shadow-[var(--shadow-card)]", children: [_jsx(ShimmerBlock, { width: "40%", height: 14, rounded: 4 }), _jsx("div", { className: "mt-[var(--spacing-lg)] flex flex-col gap-[var(--spacing-base)]", children: Array.from({ length: 5 }).map((_, i) => (_jsx(ShimmerBlock, { width: "90%", height: 12 }, i))) })] })] }), _jsxs("div", { className: "rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-[var(--spacing-3xl)] shadow-[var(--shadow-card)]", children: [_jsx("div", { className: "mb-[var(--spacing-2xl)] flex gap-[var(--spacing-4xl)]", children: Array.from({ length: 3 }).map((_, i) => (_jsx(ShimmerBlock, { width: 60, height: 14, rounded: 4 }, i))) }), _jsx("div", { className: "flex flex-col gap-[var(--spacing-base)]", children: Array.from({ length: 5 }).map((_, i) => (_jsx(ShimmerBlock, { width: "100%", height: 14 }, i))) })] })] }));
}
/** Single KPI card skeleton — label placeholder (50%) + value placeholder (30%) */
function KPICardSkeleton() {
    return (_jsxs("div", { className: "flex flex-col justify-center rounded-[var(--radius-xl)] bg-[var(--color-bg-card)] p-[var(--spacing-xl)] shadow-[var(--shadow-card)]", children: [_jsx(ShimmerBlock, { width: "50%", height: 8, rounded: 3 }), _jsx("div", { className: "mt-[var(--spacing-md)]", children: _jsx(ShimmerBlock, { width: "30%", height: 16, rounded: 4 }) }), _jsx("div", { className: "mt-[var(--spacing-xs)]", children: _jsx(ShimmerBlock, { width: "60%", height: 8, rounded: 3 }) })] }));
}
