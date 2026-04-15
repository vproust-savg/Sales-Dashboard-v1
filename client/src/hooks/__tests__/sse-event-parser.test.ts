// FILE: client/src/hooks/__tests__/sse-event-parser.test.ts
// PURPOSE: Verify pure SSE event parsers isolate data extraction from React hook plumbing.
// USED BY: vitest

import { describe, it, expect } from 'vitest';
import { parseSSEProgressEvent, parseSSEErrorEvent } from '../sse-event-parser';

describe('parseSSEProgressEvent', () => {
  it('parses a valid progress payload (PE-T1)', () => {
    const event = new MessageEvent('progress', {
      data: '{"phase":"fetching","rowsFetched":5000,"estimatedTotal":10000}',
    });
    expect(parseSSEProgressEvent(event)).toEqual({
      phase: 'fetching', rowsFetched: 5000, estimatedTotal: 10000,
    });
  });

  it('returns null for malformed JSON (PE-T2)', () => {
    const event = new MessageEvent('progress', { data: 'not-json' });
    expect(parseSSEProgressEvent(event)).toBeNull();
  });

  it('returns null when phase is missing (PE-T3)', () => {
    const event = new MessageEvent('progress', { data: '{"wrong":"shape"}' });
    expect(parseSSEProgressEvent(event)).toBeNull();
  });
});

describe('parseSSEErrorEvent', () => {
  it('extracts message from server-sent error event (PE-T4)', () => {
    const event = new MessageEvent('error', { data: '{"message":"Priority timeout"}' });
    expect(parseSSEErrorEvent(event)).toBe('Priority timeout');
  });

  it('returns "Connection lost" for native Event with no data (PE-T5)', () => {
    expect(parseSSEErrorEvent(new Event('error'))).toBe('Connection lost');
  });

  it('returns "Connection lost" for malformed JSON in error data (PE-T6)', () => {
    const event = new MessageEvent('error', { data: 'garbage{json' });
    expect(parseSSEErrorEvent(event)).toBe('Connection lost');
  });
});
