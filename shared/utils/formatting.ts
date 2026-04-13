// FILE: shared/utils/formatting.ts
// PURPOSE: Number, currency, date formatting shared between server + client
// USED BY: server/services/data-aggregator.ts, client/components/**
// EXPORTS: formatInteger, formatCurrency, formatCurrencyCompact, formatPercent, formatPercentPoints, formatFrequency, formatDays, formatDate, formatDateShort

interface FormatOptions {
  showSign?: boolean;
}

const EM_DASH = '\u2014';

function getRuntimeLocale(): string {
  if (typeof navigator !== 'undefined') {
    return navigator.languages?.[0] ?? navigator.language ?? 'en-US';
  }
  return 'en-US';
}

function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(getRuntimeLocale(), options).format(value);
}

export function formatInteger(value: number): string {
  return formatNumber(Math.round(value));
}

export function formatCurrency(value: number, opts?: FormatOptions): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : opts?.showSign && value > 0 ? '+' : '';
  if (abs === 0) return '$0';
  if (abs < 1000) return `${sign}$${abs.toFixed(2)}`;
  return `${sign}$${formatInteger(abs)}`;
}

export function formatCurrencyCompact(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return k % 1 === 0 ? `${sign}$${k}K` : `${sign}$${k.toFixed(1)}K`;
  }
  return `${sign}$${abs}`;
}

export function formatPercent(value: number, opts?: FormatOptions): string {
  const sign = opts?.showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function formatPercentPoints(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}pp`;
}

export function formatFrequency(value: number | null): string {
  if (value === null) return EM_DASH;
  return `${value.toFixed(1)}/mo`;
}

export function formatDays(value: number | null): string {
  if (value === null) return 'No orders';
  if (value === 0) return 'Today';
  if (value === 1) return '1 day ago';
  return `${value} days ago`;
}

export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat(getRuntimeLocale(), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(isoDate));
}

export function formatDateShort(isoDate: string): string {
  return new Intl.DateTimeFormat(getRuntimeLocale(), {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(isoDate));
}
