// FILE: client/src/hooks/__tests__/build-report-url.test.ts
// PURPOSE: Tests for buildReportUrl pure URL constructor
// USED BY: vitest runner
// EXPORTS: none

import { describe, it, expect } from 'vitest';
import { buildReportUrl } from '../build-report-url';

describe('buildReportUrl', () => {
  it('builds baseline URL with just dimension and period', () => {
    const url = buildReportUrl('customer', 'ytd', {});
    expect(url).toBe('/api/sales/fetch-all?groupBy=customer&period=ytd');
  });

  it('does NOT include refresh param by default', () => {
    const url = buildReportUrl('customer', 'ytd', {});
    expect(url).not.toContain('refresh');
  });

  it('includes refresh=true when forceRefresh=true', () => {
    const url = buildReportUrl('customer', 'ytd', {}, true);
    expect(url).toContain('refresh=true');
  });

  it('does NOT include refresh when forceRefresh is explicitly false', () => {
    const url = buildReportUrl('customer', 'ytd', {}, false);
    expect(url).not.toContain('refresh');
  });

  it('includes agentName when filters.agentName is set', () => {
    const url = buildReportUrl('customer', 'ytd', { agentName: ['Alexandra'] });
    expect(url).toContain('agentName=Alexandra');
  });

  it('joins multiple agent names with comma (URL-encoded)', () => {
    const url = buildReportUrl('customer', 'ytd', { agentName: ['Alice', 'Bob'] });
    expect(url).toContain('agentName=Alice%2CBob');
  });

  it('includes zone filter', () => {
    const url = buildReportUrl('customer', 'ytd', { zone: ['East'] });
    expect(url).toContain('zone=East');
  });

  it('includes customerType filter', () => {
    const url = buildReportUrl('customer', 'ytd', { customerType: ['Retail'] });
    expect(url).toContain('customerType=Retail');
  });

  it('combines filters + forceRefresh correctly', () => {
    const url = buildReportUrl(
      'customer',
      'ytd',
      { agentName: ['Alexandra'], zone: ['East'] },
      true,
    );
    expect(url).toContain('agentName=Alexandra');
    expect(url).toContain('zone=East');
    expect(url).toContain('refresh=true');
  });

  it('omits empty-array filters', () => {
    const url = buildReportUrl('customer', 'ytd', { agentName: [] });
    expect(url).not.toContain('agentName');
  });

  it('includes entityIds when present (D3)', () => {
    const url = buildReportUrl('customer', 'ytd', { entityIds: ['C001', 'C002'] }, false);
    expect(url).toContain('entityIds=C001%2CC002');
  });

  it('includes brand filter', () => {
    const url = buildReportUrl('vendor', 'ytd', { brand: ['Acme'] });
    expect(url).toContain('brand=Acme');
  });

  it('includes productFamily filter', () => {
    const url = buildReportUrl('product', 'ytd', { productFamily: ['Snacks'] });
    expect(url).toContain('productFamily=Snacks');
  });

  it('includes countryOfOrigin filter', () => {
    const url = buildReportUrl('product', 'ytd', { countryOfOrigin: ['US'] });
    expect(url).toContain('countryOfOrigin=US');
  });

  it('includes foodServiceRetail filter', () => {
    const url = buildReportUrl('product', 'ytd', { foodServiceRetail: ['Y'] });
    expect(url).toContain('foodServiceRetail=Y');
  });

  it('omits empty item-level filters', () => {
    const url = buildReportUrl('vendor', 'ytd', { brand: [], productFamily: [] });
    expect(url).not.toContain('brand');
    expect(url).not.toContain('productFamily');
  });

  it('URL is parseable back to same params', () => {
    const url = buildReportUrl('vendor', '2024', { customerType: ['Retail'] }, true);
    const search = new URL(url, 'http://localhost').searchParams;
    expect(search.get('groupBy')).toBe('vendor');
    expect(search.get('period')).toBe('2024');
    expect(search.get('customerType')).toBe('Retail');
    expect(search.get('refresh')).toBe('true');
  });
});
