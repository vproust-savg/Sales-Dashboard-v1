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

  it('URL is parseable back to same params', () => {
    const url = buildReportUrl('vendor', '2024', { customerType: ['Retail'] }, true);
    const search = new URL(url, 'http://localhost').searchParams;
    expect(search.get('groupBy')).toBe('vendor');
    expect(search.get('period')).toBe('2024');
    expect(search.get('customerType')).toBe('Retail');
    expect(search.get('refresh')).toBe('true');
  });
});
