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

/** WHY: Guard against oversized error messages (e.g., raw order data leaking through from a
 *  failed JSON.stringify). The server now also truncates, but this is defense-in-depth so
 *  the error modal never renders a wall of unreadable text regardless of the source. */
const MAX_ERROR_LENGTH = 300;

/** Returns the error message — server-sent message if present, fallback 'Connection lost' otherwise. */
export function parseSSEErrorEvent(event: Event): string {
  if (event instanceof MessageEvent && event.data) {
    try {
      const data = JSON.parse(event.data) as { message?: string } | null;
      const msg = data?.message ?? 'Connection lost';
      return msg.length > MAX_ERROR_LENGTH ? msg.slice(0, MAX_ERROR_LENGTH) + '…' : msg;
    } catch {
      return 'Connection lost';
    }
  }
  return 'Connection lost';
}
