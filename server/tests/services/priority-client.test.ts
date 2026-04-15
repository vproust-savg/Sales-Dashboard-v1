// FILE: server/tests/services/priority-client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PriorityClient, PriorityApiError } from '../../src/services/priority-client';

// WHY: We mock fetch to avoid hitting the real Priority API in tests.
// Tests verify URL construction, header inclusion, pagination, and error parsing.
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeClient() {
  return new PriorityClient({
    baseUrl: 'https://test.priority.com/odata/Priority/test.ini/co',
    username: 'user',
    password: 'pass',
  });
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('PriorityClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('headers', () => {
    it('includes IEEE754Compatible and Basic Auth on every request', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));
      const client = makeClient();
      await client.fetchEntity('ORDERS', { select: 'ORDNAME', top: 10 });

      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers['IEEE754Compatible']).toBe('true');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(init.headers['Prefer']).toBe('odata.maxpagesize=49900');
      expect(init.headers['Authorization']).toMatch(/^Basic /);
    });
  });

  describe('URL construction', () => {
    it('builds correct OData URL with $select, $filter, $top, $skip', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));
      const client = makeClient();
      await client.fetchEntity('ORDERS', {
        select: 'ORDNAME,CURDATE',
        filter: "CURDATE ge 2026-01-01T00:00:00Z",
        top: 500,
        skip: 0,
        orderby: 'ORDNAME asc',
      });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/ORDERS?');
      expect(url).toContain('$select=ORDNAME,CURDATE');
      expect(url).toContain('$filter=CURDATE%20ge%202026-01-01T00%3A00%3A00Z');
      expect(url).toContain('$top=500');
      expect(url).toContain('$skip=0');
      expect(url).toContain('$orderby=ORDNAME%20asc');
    });

    it('appends $expand as raw string (not form-encoded)', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));
      const client = makeClient();
      await client.fetchEntity('ORDERS', {
        select: 'ORDNAME',
        top: 10,
        expand: 'ORDERITEMS_SUBFORM($select=PARTNAME,QPRICE)',
      });

      const url = mockFetch.mock.calls[0][0] as string;
      // WHY: URL.searchParams.set() would encode ( ) $ = which breaks Priority's OData parser
      expect(url).toContain('$expand=ORDERITEMS_SUBFORM($select=PARTNAME,QPRICE)');
      expect(url).not.toContain('%28');  // No encoded parens
      expect(url).not.toContain('%29');
    });
  });

  describe('error parsing', () => {
    it('parses OData standard error format', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(
        { error: { code: '404', message: 'Entity not found' } },
        404
      ));
      const client = makeClient();
      await expect(client.fetchEntity('ORDERS', { select: 'ORDNAME', top: 1 }))
        .rejects.toThrow(PriorityApiError);
    });

    it('parses Priority InterfaceErrors format', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(
        { FORM: { InterfaceErrors: { text: 'Line 1- error here' } } },
        400
      ));
      const client = makeClient();
      await expect(client.fetchEntity('ORDERS', { select: 'ORDNAME', top: 1 }))
        .rejects.toThrow('Line 1- error here');
    });
  });

  describe('retry on transient errors', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('retries on 429 and succeeds when a later attempt returns 200', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ message: 'Too Many Requests' }, 429))
        .mockResolvedValueOnce(jsonResponse({ message: 'Too Many Requests' }, 429))
        .mockResolvedValueOnce(jsonResponse({ value: [{ ORDNAME: 'SO001' }] }));
      const client = makeClient();

      const promise = client.fetchEntity('ORDERS', { select: 'ORDNAME', top: 1 });
      // Advance timers past the backoff delays so retries fire
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual([{ ORDNAME: 'SO001' }]);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('retries on 500 and succeeds when a later attempt returns 200', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ 'odata.error': { message: { value: 'Server Error' } } }, 500))
        .mockResolvedValueOnce(jsonResponse({ value: [{ ORDNAME: 'SO002' }] }));
      const client = makeClient();

      const promise = client.fetchEntity('ORDERS', { select: 'ORDNAME', top: 1 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual([{ ORDNAME: 'SO002' }]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('does not retry on 404 — throws immediately after one attempt', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Not Found' }, 404));
      const client = makeClient();

      await expect(client.fetchEntity('ORDERS', { select: 'ORDNAME', top: 1 }))
        .rejects.toThrow(PriorityApiError);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws after exhausting all retries on persistent 429', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ message: 'Too Many Requests' }, 429))
        .mockResolvedValueOnce(jsonResponse({ message: 'Too Many Requests' }, 429))
        .mockResolvedValueOnce(jsonResponse({ message: 'Too Many Requests' }, 429));
      const client = makeClient();

      const promise = client.fetchEntity('ORDERS', { select: 'ORDNAME', top: 1 });
      // WHY: Attach assertion BEFORE advancing timers so the rejection is always
      // handled — avoids the "PromiseRejectionHandledWarning: handled asynchronously" warning.
      const assertion = expect(promise).rejects.toThrow(PriorityApiError);
      await vi.runAllTimersAsync();
      await assertion;

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('pagination', () => {
    it('fetches all pages when data spans multiple pages', async () => {
      // Page 1: 3 records (simulating pageSize=3)
      mockFetch.mockResolvedValueOnce(jsonResponse({
        value: [{ ORDNAME: 'A' }, { ORDNAME: 'B' }, { ORDNAME: 'C' }],
      }));
      // Page 2: 1 record (last page)
      mockFetch.mockResolvedValueOnce(jsonResponse({
        value: [{ ORDNAME: 'D' }],
      }));

      const client = makeClient();
      const results = await client.fetchAllPages('ORDERS', {
        select: 'ORDNAME',
        orderby: 'ORDNAME asc',
        pageSize: 3,
      });

      expect(results).toHaveLength(4);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('per-page onProgress (A2)', () => {
    it('fires onProgress at least once per inner-loop page (A2-T1)', async () => {
      const client = new PriorityClient({ baseUrl: 'http://test', username: 'x', password: 'y' });
      // Mock 4 pages: 3 full + 1 partial (single batch, no MAXAPILINES cursor)
      vi.spyOn(client, 'fetchEntity')
        .mockResolvedValueOnce(Array(2500).fill({ ORDNAME: 'O1' }))
        .mockResolvedValueOnce(Array(2500).fill({ ORDNAME: 'O2' }))
        .mockResolvedValueOnce(Array(2500).fill({ ORDNAME: 'O3' }))
        .mockResolvedValueOnce(Array(1).fill({ ORDNAME: 'O4' }));

      const calls: Array<{ rowsFetched: number; estimatedTotal: number }> = [];
      await client.fetchAllPages('ORDERS', {
        select: 'ORDNAME', orderby: 'ORDNAME asc',
        pageSize: 2500,  // WHY: match mock page size so first 3 pages are "full" and trigger next iteration
        onProgress: (rowsFetched, estimatedTotal) => calls.push({ rowsFetched, estimatedTotal }),
      });

      expect(calls.length).toBeGreaterThanOrEqual(4);
    });

    it('rowsFetched is monotonically increasing (A2-T2)', async () => {
      const client = new PriorityClient({ baseUrl: 'http://test', username: 'x', password: 'y' });
      vi.spyOn(client, 'fetchEntity')
        .mockResolvedValueOnce(Array(2500).fill({ ORDNAME: 'O1' }))
        .mockResolvedValueOnce(Array(2500).fill({ ORDNAME: 'O2' }))
        .mockResolvedValueOnce(Array(1).fill({ ORDNAME: 'O3' }));
      const calls: number[] = [];
      await client.fetchAllPages('ORDERS', {
        select: 'ORDNAME', orderby: 'ORDNAME asc',
        pageSize: 2500,
        onProgress: (rowsFetched) => calls.push(rowsFetched),
      });
      // WHY: Assert multiple calls BEFORE checking monotonicity. A single-call regression
      // (pre-A2 behavior — one onProgress per outer batch) trivially satisfies an empty
      // monotonicity loop; requiring ≥3 calls ensures the test actually exercises the
      // per-page firing path.
      expect(calls.length).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < calls.length; i++) {
        expect(calls[i]).toBeGreaterThanOrEqual(calls[i - 1]);
      }
    });

    it('final partial page has estimatedTotal === rowsFetched (A2-T3)', async () => {
      const client = new PriorityClient({ baseUrl: 'http://test', username: 'x', password: 'y' });
      vi.spyOn(client, 'fetchEntity')
        .mockResolvedValueOnce(Array(2500).fill({ ORDNAME: 'O1' }))
        .mockResolvedValueOnce(Array(123).fill({ ORDNAME: 'O2' }));
      const calls: Array<{ rowsFetched: number; estimatedTotal: number }> = [];
      await client.fetchAllPages('ORDERS', {
        select: 'ORDNAME', orderby: 'ORDNAME asc',
        pageSize: 2500,
        onProgress: (rowsFetched, estimatedTotal) => calls.push({ rowsFetched, estimatedTotal }),
      });
      // WHY: Require ≥2 calls so the test fails if onProgress fires only once (the pre-A2
      // per-batch regression would pass otherwise — a single call always equals itself on
      // the final-page assertion).
      expect(calls.length).toBeGreaterThanOrEqual(2);
      const last = calls[calls.length - 1];
      expect(last.estimatedTotal).toBe(last.rowsFetched);
      expect(last.rowsFetched).toBe(2623);
    });

    it('intermediate calls have estimatedTotal === rowsFetched + pageSize (A2-T4)', async () => {
      const client = new PriorityClient({ baseUrl: 'http://test', username: 'x', password: 'y' });
      vi.spyOn(client, 'fetchEntity')
        .mockResolvedValueOnce(Array(2500).fill({ ORDNAME: 'O1' }))
        .mockResolvedValueOnce(Array(2500).fill({ ORDNAME: 'O2' }))
        .mockResolvedValueOnce(Array(50).fill({ ORDNAME: 'O3' }));
      const calls: Array<{ rowsFetched: number; estimatedTotal: number }> = [];
      await client.fetchAllPages('ORDERS', {
        select: 'ORDNAME', orderby: 'ORDNAME asc',
        pageSize: 2500,
        onProgress: (rowsFetched, estimatedTotal) => calls.push({ rowsFetched, estimatedTotal }),
      });
      // WHY: Pin the fixture's expected page count — 3 pages in, 3 progress events out.
      // Without this, a regression that fires only 2 events still passes the calls[0]/[1]
      // checks (both indices exist) but silently loses the final-page event.
      expect(calls.length).toBe(3);
      expect(calls[0].estimatedTotal).toBe(calls[0].rowsFetched + 2500);
      expect(calls[1].estimatedTotal).toBe(calls[1].rowsFetched + 2500);
    });

    it('does not invoke onProgress for empty fetchEntity result (A2-T5)', async () => {
      const client = new PriorityClient({ baseUrl: 'http://test', username: 'x', password: 'y' });
      vi.spyOn(client, 'fetchEntity').mockResolvedValueOnce([]);
      const calls: number[] = [];
      await client.fetchAllPages('ORDERS', {
        select: 'ORDNAME', orderby: 'ORDNAME asc',
        pageSize: 2500,
        onProgress: (rowsFetched) => calls.push(rowsFetched),
      });
      expect(calls.length).toBe(0);
    });
  });

  describe('AbortSignal threading (D1)', () => {
    it('aborts during retry backoff without waiting it out (D1-T2)', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });

      const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({ 'odata.error': { message: { value: 'Server Error' } } }),
          { status: 500, headers: { 'content-type': 'application/json' } },
        ),
      );
      vi.stubGlobal('fetch', fetchSpy);

      const client = new PriorityClient({ baseUrl: 'http://test', username: 'x', password: 'y' });
      const controller = new AbortController();

      const promise = client.fetchAllPages('ORDERS', {
        select: 'ORDNAME', orderby: 'ORDNAME asc', signal: controller.signal,
      });
      // WHY: Attach rejection handler immediately so no unhandled-rejection warning fires
      // before the await expect below can catch it.
      const assertion = expect(promise).rejects.toThrow(/abort/i);

      // Allow the first fetch (500) to land and enter the backoff wait
      await vi.advanceTimersByTimeAsync(10);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Abort during the backoff window — backoff Promise rejects immediately
      controller.abort(new Error('Client cancelled Report'));
      await vi.advanceTimersByTimeAsync(1);

      await assertion;
      // Still only 1 fetch — backoff was cut short, no retry happened
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    it('AbortSignal.any preserves user-cancellation reason over timeout (D1-T4)', async () => {
      const fetchSpy = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
        return new Promise<Response>((_resolve, reject) => {
          const sig = init?.signal as AbortSignal | undefined;
          if (!sig) { reject(new Error('test setup: no signal')); return; }
          if (sig.aborted) { reject(sig.reason ?? new DOMException('Aborted', 'AbortError')); return; }
          sig.addEventListener('abort', () => {
            reject(sig.reason ?? new DOMException('Aborted', 'AbortError'));
          });
        });
      });
      vi.stubGlobal('fetch', fetchSpy);

      const client = new PriorityClient({ baseUrl: 'http://test', username: 'x', password: 'y' });
      const controller = new AbortController();
      const userReason = new Error('Client cancelled Report');

      const promise = client.fetchAllPages('ORDERS', {
        select: 'ORDNAME', orderby: 'ORDNAME asc', signal: controller.signal,
      });

      await new Promise(r => setImmediate(r));
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      controller.abort(userReason);

      await expect(promise).rejects.toThrow('Client cancelled Report');

      vi.unstubAllGlobals();
    });

    it('aborts pagination loop between pages on signal abort (D1-T1)', async () => {
      const client = new PriorityClient({ baseUrl: 'http://test', username: 'x', password: 'y' });
      // WHY: Each mock call waits a macrotask so controller.abort() fired via setImmediate
      // can be seen by the per-page abort check before the next fetchEntity call starts.
      const fetchSpy = vi.spyOn(client, 'fetchEntity')
        .mockImplementation(() => new Promise(r => setImmediate(() => r(Array(2500).fill({ ORDNAME: 'O' })))));

      const controller = new AbortController();
      const promise = client.fetchAllPages('ORDERS', {
        select: 'ORDNAME', orderby: 'ORDNAME asc',
        pageSize: 2500,
        signal: controller.signal,
      });

      // Let the first page complete then abort
      await new Promise(r => setImmediate(r));
      await new Promise(r => setImmediate(r));
      controller.abort(new Error('Client cancelled Report'));

      await expect(promise).rejects.toThrow(/abort/i);
      // Stop within a few iterations — not all MAXAPILINES passes
      expect(fetchSpy.mock.calls.length).toBeLessThan(5);
    });
  });

  describe('per-page timing log (C2)', () => {
    it('emits a structured log line per fetched page (C2-T2)', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const client = new PriorityClient({ baseUrl: 'http://test', username: 'x', password: 'y' });

      // WHY: pageSize=2500 so the first page (2500 records) fills the page exactly,
      // triggering a second inner-loop page fetch — giving us 2 log lines to assert against.
      vi.spyOn(client, 'fetchEntity')
        .mockResolvedValueOnce(Array(2500).fill({ ORDNAME: 'O1' }))
        .mockResolvedValueOnce([{ ORDNAME: 'O2' }]);

      await client.fetchAllPages('ORDERS', { select: 'ORDNAME', orderby: 'ORDNAME asc', pageSize: 2500 });

      const matchingLogs = logSpy.mock.calls
        .map(c => c[0] as string)
        .filter(line => /^\[priority\] ORDERS page skip=\d+ got=\d+ in \d+ms/.test(line));
      expect(matchingLogs.length).toBeGreaterThanOrEqual(2);

      logSpy.mockRestore();
    });
  });
});
