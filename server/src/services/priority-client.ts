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
}

interface PaginateOptions {
  select: string;
  filter?: string;
  orderby: string;
  expand?: string;
  pageSize?: number;
  cursorField?: string;
  onProgress?: (rowsFetched: number, estimatedTotal: number) => void;
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
      await this.throttle();
      const url = buildODataUrl(this.baseUrl, entity, opts);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'IEEE754Compatible': 'true',
          'Prefer': 'odata.maxpagesize=49900',
          'Authorization': this.authHeader,
        },
        signal: AbortSignal.timeout(API_LIMITS.REQUEST_TIMEOUT_MS),
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
      await new Promise(r => setTimeout(r, waitMs));
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
      const batch: T[] = [];
      let skip = 0;

      // Inner loop: $top/$skip pages within each context
      while (true) {
        const filter = this.buildCursorFilter(opts.filter, cursorField, cursorValue);
        const pageStart = Date.now();
        const records = await this.fetchEntity<T>(entity, {
          select: opts.select,
          filter,
          top: pageSize,
          skip,
          orderby: opts.orderby,
          expand: opts.expand,
        });
        const elapsedMs = Date.now() - pageStart;
        console.log(`[priority] ${entity} page skip=${skip} got=${records.length} in ${elapsedMs}ms (total=${allRecords.length + batch.length + records.length})`);

        if (records.length === 0) break;
        batch.push(...records);
        if (records.length < pageSize) break;
        skip += pageSize;
      }

      allRecords.push(...batch);

      // WHY: Report progress after each batch for SSE streaming
      if (opts.onProgress) {
        const hasMore = batch.length > 0 && batch.length % pageSize === 0 && batch.length >= pageSize;
        const estimated = hasMore ? allRecords.length + pageSize : allRecords.length;
        opts.onProgress(allRecords.length, estimated);
      }

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
  private async throttle(): Promise<void> {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(t => now - t < 60_000);

    if (this.requestTimestamps.length >= API_LIMITS.CALLS_PER_MINUTE) {
      const oldest = this.requestTimestamps[0];
      const waitMs = 60_000 - (now - oldest) + 100;
      if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));
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
