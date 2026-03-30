import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ProductMixDonut } from './ProductMixDonut';
import { TopTenBestSellers } from './TopTenBestSellers';
export function ChartsRow({ productMix, topSellers }) {
    return (_jsxs("div", { className: "grid grid-cols-[3fr_5fr] gap-[var(--spacing-lg)]", children: [_jsxs("div", { className: "flex flex-col rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)]", children: [_jsx("h2", { className: "mb-[var(--spacing-lg)] text-[14px] font-semibold text-[var(--color-text-primary)]", children: "Product Mix" }), _jsx("div", { className: "flex flex-1 items-center justify-center", children: _jsx(ProductMixDonut, { data: productMix }) })] }), _jsxs("div", { className: "flex flex-col rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)]", children: [_jsx("h2", { className: "mb-[var(--spacing-lg)] text-[14px] font-semibold text-[var(--color-text-primary)]", children: "Top 10 Best Sellers" }), _jsx(TopTenBestSellers, { data: topSellers })] })] }));
}
