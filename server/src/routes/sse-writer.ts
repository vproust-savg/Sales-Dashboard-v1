// FILE: server/src/routes/sse-writer.ts
// PURPOSE: Guarded SSE writer + heartbeat for long-running SSE routes.
//   Single source of truth for "should I write to this socket?" — prevents the silent-close
//   crash path where a client disconnect raced an in-flight progress write.
// USED BY: server/src/routes/fetch-all.ts (and any future SSE route)
// EXPORTS: createSseWriter, SseWriter

import type { Request, Response } from 'express';

export interface SseWriter {
  /** Sends an SSE event; no-ops if the connection has been marked closed. */
  sendEvent: (event: string, data: unknown) => void;
  /** Returns true if the write-guard has been tripped (req.on('close') fired OR a write threw). */
  isClosed: () => boolean;
  /** Stops the heartbeat interval and marks the writer closed. Call from the route's finally block. */
  dispose: () => void;
}

/**
 * Wire up SSE headers, a write guard (connectionClosed flag + req.on('close') listener), a
 * heartbeat interval (keeps Railway nginx from dropping the connection on its ~60s idle timeout),
 * and a guarded sendEvent. All writes check the closed flag and catch write errors.
 *
 * WHY extracted: the route handler is long; keeping the write guard here makes it trivially
 * testable AND importable from future SSE routes without copy-paste.
 */
export function createSseWriter(req: Request, res: Response): SseWriter {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
  });

  let connectionClosed = false;
  let heartbeat: NodeJS.Timeout | null = null;

  const isClosed = () => connectionClosed || res.writableEnded;

  const clearHeartbeat = () => {
    if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
  };

  const sendEvent = (event: string, data: unknown) => {
    if (isClosed()) return;
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      console.warn('[sse-writer] write failed, marking connection closed:', err);
      connectionClosed = true;
      clearHeartbeat();
    }
  };

  // WHY: Railway nginx ~60s idle timeout. Heartbeat keeps SSE alive during long async work
  // (Redis reads, aggregation) that isn't otherwise generating SSE events.
  heartbeat = setInterval(() => {
    if (isClosed()) { clearHeartbeat(); return; }
    try { res.write(': heartbeat\n\n'); }
    catch (err) {
      console.warn('[sse-writer] heartbeat write failed, marking connection closed:', err);
      connectionClosed = true;
      clearHeartbeat();
    }
  }, 25_000);

  req.on('close', () => {
    connectionClosed = true;
    clearHeartbeat();
  });

  const dispose = () => {
    connectionClosed = true;
    clearHeartbeat();
  };

  return { sendEvent, isClosed, dispose };
}
