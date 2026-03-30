// FILE: server/src/services/priority-client.ts
// PURPOSE: HTTP client for Priority ERP OData API with auth, rate limiting, pagination, error parsing
// USED BY: server/src/services/priority-queries.ts
// EXPORTS: PriorityClient, PriorityApiError

import { API_LIMITS, PAGE_SIZE } from '../config/constants.js';

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
}

interface ClientConfig {
  baseUrl: string;
  username: string;
  password: string;
}

export class PriorityApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public retryable: boolean,
  ) {
    super(message);
    this.name = 'PriorityApiError';
  }
}

export class PriorityClient {
  private baseUrl: string;
  private authHeader: string;
  private requestTimestamps: number[] = [];

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl;
    this.authHeader = 'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64');
  }

  /** Fetch a single page from a Priority entity */
  async fetchEntity<T = Record<string, unknown>>(
    entity: string,
    opts: FetchOptions,
  ): Promise<T[]> {
    await this.throttle();
    const url = this.buildUrl(entity, opts);
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

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = this.extractError(body, response);
      const retryable = response.status === 429 || response.status >= 500;
      throw new PriorityApiError(message, response.status, retryable);
    }

    const body = await response.json();
    return body.value ?? [];
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

    // Outer loop: MAXAPILINES query contexts
    while (true) {
      const batch: T[] = [];
      let skip = 0;

      // Inner loop: $top/$skip pages within each context
      while (true) {
        const filter = this.buildCursorFilter(opts.filter, cursorField, cursorValue);
        const records = await this.fetchEntity<T>(entity, {
          select: opts.select,
          filter,
          top: pageSize,
          skip,
          orderby: opts.orderby,
          expand: opts.expand,
        });

        if (records.length === 0) break;
        batch.push(...records);
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
        } else {
          break; // Can't cursor on non-string field
        }
      } else {
        break; // Got all records
      }
    }

    return allRecords;
  }

  /** Build OData URL — spec Section 17.8 (URL encoding trap) */
  private buildUrl(entity: string, opts: FetchOptions): string {
    const params: string[] = [];
    if (opts.select) params.push(`$select=${opts.select}`);
    if (opts.filter) params.push(`$filter=${encodeURIComponent(opts.filter)}`);
    if (opts.top !== undefined) params.push(`$top=${opts.top}`);
    if (opts.skip !== undefined) params.push(`$skip=${opts.skip}`);
    if (opts.orderby) params.push(`$orderby=${encodeURIComponent(opts.orderby)}`);

    let url = `${this.baseUrl}/${entity}`;
    if (params.length > 0) url += '?' + params.join('&');

    // WHY: $expand contains nested OData syntax with ( ) $ = characters.
    // URL.searchParams.set() would form-encode these, breaking Priority's parser.
    // Append raw instead — these chars are valid per RFC 3986.
    if (opts.expand) {
      url += (params.length > 0 ? '&' : '?') + `$expand=${opts.expand}`;
    }

    return url;
  }

  /** Parse both Priority error formats — spec Section 17.7 */
  private extractError(body: unknown, response: Response): string {
    if (body && typeof body === 'object') {
      const obj = body as Record<string, unknown>;
      // Format 1: OData standard
      if (obj.error && typeof obj.error === 'object') {
        return (obj.error as Record<string, string>).message ?? `HTTP ${response.status}`;
      }
      // Format 2: Priority InterfaceErrors
      if (obj.FORM && typeof obj.FORM === 'object') {
        const form = obj.FORM as Record<string, unknown>;
        if (form.InterfaceErrors && typeof form.InterfaceErrors === 'object') {
          return (form.InterfaceErrors as Record<string, string>).text ?? `HTTP ${response.status}`;
        }
      }
    }
    return `HTTP ${response.status}: ${response.statusText}`;
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
