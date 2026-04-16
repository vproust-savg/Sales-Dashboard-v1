// FILE: server/src/services/priority-client.ts
// PURPOSE: HTTP client for Priority ERP OData API with auth, rate limiting, pagination
// USED BY: server/src/services/priority-queries.ts
// EXPORTS: PriorityClient, PriorityApiError

import { API_LIMITS, PAGE_SIZE } from '../config/constants.js';
import { PriorityApiError, buildODataUrl, extractPriorityError } from './priority-http.js';

// WHY: Re-export so callers can import PriorityApiError from the same module
export { PriorityApiError } from './priority-http.js';

interface FetchOptions {
  select: string;
  filter?: string;
  top?: number;
  skip?: number;
  orderby?: string;
  expand?: string;
  /** WHY: D1 — when the SSE client cancels, abort the in-flight Priority fetch so we don't
   *  burn API budget on work the user no longer wants. Combined with timeout via AbortSignal.any. */
  signal?: AbortSignal;
}

interface PaginateOptions {
  select: string;
  filter?: string;
  orderby: string;
  expand?: string;
  pageSize?: number;
  cursorField?: string;
  onProgress?: (rowsFetched: number, estimatedTotal: number) => void;
  /** WHY: D1 — propagates client disconnect through the full pagination loop so every
   *  Priority page fetch can be cancelled as soon as the user closes the Report modal. */
  signal?: AbortSignal;
}

interface ClientConfig {
  baseUrl: string;
  username: string;
  password: string;
}

export class PriorityClient {
  private baseUrl: string;
  private authHeader: string;
  private requestTimestamps: number[] = [];

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl;
    this.authHeader = 'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64');
  }

  /** Fetch a single page from a Priority entity — retries on 429/5xx (spec Section 14) */
  async fetchEntity<T = Record<string, unknown>>(
    entity: string,
    opts: FetchOptions,
  ): Promise<T[]> {
    let lastError: PriorityApiError | null = null;

    for (let attempt = 0; attempt < API_LIMITS.MAX_RETRIES; attempt++) {
      await this.throttle(opts.signal);
      const url = buildODataUrl(this.baseUrl, entity, opts);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'IEEE754Compatible': 'true',
          'Prefer': 'odata.maxpagesize=49900',
          'Authorization': this.authHeader,
        },
        // WHY: D1 — combine user cancellation signal with per-request timeout. Either
        // fires first and the fetch aborts. Without AbortSignal.any, a cancelled SSE
        // connection would still hold the request open until the 3-min timeout.
        signal: opts.signal
          ? AbortSignal.any([opts.signal, AbortSignal.timeout(API_LIMITS.REQUEST_TIMEOUT_MS)])
          : AbortSignal.timeout(API_LIMITS.REQUEST_TIMEOUT_MS),
      });

      if (response.ok) {
        const body = await response.json();
        return body.value ?? [];
      }

      const body = await response.json().catch(() => null);
      const message = extractPriorityError(body, response);
      const retryable = response.status === 429 || response.status >= 500;
      lastError = new PriorityApiError(message, response.status, retryable);

      // WHY: Non-retryable (4xx except 429) — no point waiting, throw immediately
      if (!retryable) throw lastError;

      // WHY: Exponential backoff: 2s, 4s, 8s — capped at 60s per spec Section 14
      const waitMs = Math.min(60_000, 1_000 * 2 ** (attempt + 1));
      // WHY: D1 — abort-aware backoff so a cancelled request exits immediately
      // instead of burning the full backoff window (up to 60s) before discovering
      // the SSE client already disconnected.
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, waitMs);
        opts.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      });
    }

    throw lastError!;
  }

  /** Fetch all pages with cursor-based pagination for MAXAPILINES — spec Section 17.4 */
  async fetchAllPages<T>(
    entity: string,
    opts: PaginateOptions,
  ): Promise<T[]> {
    const pageSize = opts.pageSize ?? PAGE_SIZE;
    const cursorField = opts.cursorField ?? this.guessCursorField(entity);
    const allRecords: T[] = [];
    let cursorValue: string | null = null;
    let previousCursorValue: string | null = null;

    // Outer loop: MAXAPILINES query contexts
    while (true) {
      // WHY: D1 — check before starting each MAXAPILINES batch; the inner loop also checks
      // per-page so both abort points are covered.
      if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const batch: T[] = [];
      let skip = 0;

      // Inner loop: $top/$skip pages within each context
      while (true) {
        // WHY: D1 — check before each page fetch; fetchEntity also checks but the guard here
        // avoids the extra throttle() call when we know we're already cancelled.
        if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const filter = this.buildCursorFilter(opts.filter, cursorField, cursorValue);
        const pageStart = Date.now();
        const records = await this.fetchEntity<T>(entity, {
          select: opts.select,
          filter,
          top: pageSize,
          skip,
          orderby: opts.orderby,
          expand: opts.expand,
          signal: opts.signal,
        });
        const elapsedMs = Date.now() - pageStart;
        console.log(`[priority] ${entity} page skip=${skip} got=${records.length} in ${elapsedMs}ms (total=${allRecords.length + batch.length + records.length})`);

        if (records.length === 0) break;
        batch.push(...records);

        // WHY: Per-page progress instead of per-MAXAPILINES-batch. For 60K orders at
        // PAGE_SIZE=5000 this yields ~12 progress events instead of 2, so the client
        // modal's Phase 1 bar fills smoothly instead of jumping 0% -> 100%.
        if (opts.onProgress) {
          const fetched = allRecords.length + batch.length;
          const hasMore = records.length === pageSize;
          opts.onProgress(fetched, hasMore ? fetched + pageSize : fetched);
        }

        if (records.length < pageSize) break;
        skip += pageSize;
      }

      allRecords.push(...batch);

      // If batch hit MAXAPILINES, continue with cursor from last record
      if (batch.length > 0 && batch.length % pageSize === 0 && batch.length >= pageSize) {
        const lastRecord = batch[batch.length - 1];
        const lastValue = (lastRecord as Record<string, unknown>)[cursorField];
        if (typeof lastValue === 'string') {
          cursorValue = lastValue.trim();
          // WHY: If last two records share the same cursor field value,
          // cursorValue doesn't advance and the outer loop would fetch forever.
          if (cursorValue === previousCursorValue) break;
          previousCursorValue = cursorValue;
        } else {
          break; // Can't cursor on non-string field
        }
      } else {
        break; // Got all records
      }
    }

    return allRecords;
  }

  /** Rate limiting — 100 calls/min — spec Section 17.5 */
  private async throttle(signal?: AbortSignal): Promise<void> {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(t => now - t < 60_000);

    if (this.requestTimestamps.length >= API_LIMITS.CALLS_PER_MINUTE) {
      const oldest = this.requestTimestamps[0];
      const waitMs = 60_000 - (now - oldest) + 100;
      if (waitMs > 0) {
        // WHY: D1 — abort-aware rate-limit wait so a cancelled SSE request exits
        // the throttle hold immediately instead of waiting up to 60s.
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, waitMs);
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        });
      }
    }

    this.requestTimestamps.push(Date.now());
  }

  /** Combine base filter with cursor filter using AND */
  private buildCursorFilter(baseFilter: string | undefined, cursorField: string, cursorValue: string | null): string | undefined {
    if (!cursorValue) return baseFilter;
    const escaped = cursorValue.replace(/'/g, "''"); // OData single-quote escape
    const cursorClause = `${cursorField} gt '${escaped}'`;
    return baseFilter ? `${baseFilter} and ${cursorClause}` : cursorClause;
  }

  /** Default cursor field per entity */
  private guessCursorField(entity: string): string {
    const map: Record<string, string> = {
      ORDERS: 'ORDNAME',
      CUSTOMERS: 'CUSTNAME',
      SUPPLIERS: 'SUPNAME',
      DISTRLINES: 'DISTRLINECODE',
      AGENTS: 'AGENTCODE',
    };
    return map[entity] ?? 'ROWID';
  }
}
