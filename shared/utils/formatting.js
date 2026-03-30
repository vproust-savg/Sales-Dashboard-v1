// FILE: shared/utils/formatting.ts
// PURPOSE: Number, currency, date formatting shared between server + client
// USED BY: server/services/data-aggregator.ts, client/components/**
// EXPORTS: formatCurrency, formatCurrencyCompact, formatPercent, formatPercentPoints, formatFrequency, formatDays, formatDate, formatDateShort
const EM_DASH = '\u2014';
export function formatCurrency(value, opts) {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : opts?.showSign && value > 0 ? '+' : '';
    if (abs === 0)
        return '$0';
    if (abs < 1000)
        return `${sign}$${abs.toFixed(2)}`;
    return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}
export function formatCurrencyCompact(value) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000)
        return `$${(abs / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000)
        return `$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) {
        const k = abs / 1_000;
        return k % 1 === 0 ? `$${k}K` : `$${k.toFixed(1)}K`;
    }
    return `$${abs}`;
}
export function formatPercent(value, opts) {
    const sign = opts?.showSign && value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
}
export function formatPercentPoints(value) {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}pp`;
}
export function formatFrequency(value) {
    if (value === null)
        return EM_DASH;
    return `${value.toFixed(1)}/mo`;
}
export function formatDays(value) {
    if (value === null)
        return 'No orders';
    if (value === 0)
        return 'Today';
    if (value === 1)
        return '1 day';
    return `${value} days`;
}
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatDate(isoDate) {
    const d = new Date(isoDate);
    return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
export function formatDateShort(isoDate) {
    const d = new Date(isoDate);
    return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
