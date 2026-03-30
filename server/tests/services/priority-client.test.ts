// FILE: server/tests/services/priority-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
});
