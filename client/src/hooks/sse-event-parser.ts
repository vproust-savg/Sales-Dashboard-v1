// FILE: client/src/hooks/sse-event-parser.ts
// PURPOSE: Pure parsers for SSE events received by useReport — isolates data extraction
//   from React hook plumbing so all parsing edge cases are unit-testable.
// USED BY: client/src/hooks/useReport.ts
// EXPORTS: parseSSEProgressEvent, parseSSEErrorEvent

import type { SSEProgressEvent } from '@shared/types/dashboard';

/** Returns the parsed progress event, or null if the payload is invalid. */
export function parseSSEProgressEvent(event: MessageEvent): SSEProgressEvent | null {
  try {
    const data = JSON.parse(event.data) as SSEProgressEvent;
    return data && typeof data === 'object' && 'phase' in data ? data : null;
  } catch {
    return null;
  }
}

/** Returns the error message — server-sent message if present, fallback 'Connection lost' otherwise. */
export function parseSSEErrorEvent(event: Event): string {
  if (event instanceof MessageEvent && event.data) {
    try {
      const data = JSON.parse(event.data) as { message?: string } | null;
      return data?.message ?? 'Connection lost';
    } catch {
      return 'Connection lost';
    }
  }
  return 'Connection lost';
}
