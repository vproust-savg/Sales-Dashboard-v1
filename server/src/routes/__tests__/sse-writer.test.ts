// FILE: server/src/routes/__tests__/sse-writer.test.ts
// PURPOSE: Verify the guarded SSE writer extracted from fetch-all.ts behaves correctly on
//   write failures, client disconnects, and heartbeat EPIPEs.
// USED BY: vitest runner

import type { Request, Response } from 'express';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { createSseWriter } from '../sse-writer.js';

// WHY: createSseWriter takes Express Request/Response but only uses req.on('close') and
// res.write/writeHead/end/writableEnded. We stub just those members and cast to the full
// type via unknown (safer than `as any`) so the test still type-checks against the real interface.
type FakeReq = Pick<Request, 'on'> & EventEmitter;
interface FakeRes {
  writeHead: (status: number, headers: Record<string, string>) => void;
  write: (chunk: string) => boolean;
  end: () => FakeRes;
  writableEnded: boolean;
}

function makeFakeReq(): FakeReq {
  return new EventEmitter() as unknown as FakeReq;
}

function makeFakeRes(writeImpl?: (chunk: string) => boolean): { res: FakeRes; writes: string[] } {
  const writes: string[] = [];
  let writableEnded = false;
  // WHY: getter via `as FakeRes` because TS struggles with getter type inference in object literals
  const res: FakeRes = {
    writeHead: vi.fn(),
    write: vi.fn((chunk: string) => {
      if (writeImpl) return writeImpl(chunk);
      writes.push(chunk);
      return true;
    }),
    end: vi.fn(() => { writableEnded = true; return res; }),
    get writableEnded() { return writableEnded; },
  } as FakeRes;
  return { res, writes };
}

describe('createSseWriter (C4)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // WHY: sse-writer logs write failures at error level (not warn) so Railway's
    // severity-filtered alerts surface a broken SSE socket mid-Report.
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    errorSpy.mockRestore();
    vi.useRealTimers();
  });

  it('sendEvent no-ops after a write throws; subsequent writes short-circuit (C4-T1)', () => {
    let writeCallCount = 0;
    const { res } = makeFakeRes(() => {
      writeCallCount++;
      if (writeCallCount === 2) throw new Error('EPIPE');
      return true;
    });
    const req = makeFakeReq();

    const sse = createSseWriter(req as unknown as Request, res as unknown as Response);
    sse.sendEvent('progress', { rowsFetched: 1000 });
    expect(writeCallCount).toBe(1);

    sse.sendEvent('progress', { rowsFetched: 2000 });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[sse-writer] write failed'),
      expect.any(Error),
    );
    expect(sse.isClosed()).toBe(true);

    // Third call must short-circuit — no further res.write invocations
    sse.sendEvent('progress', { rowsFetched: 3000 });
    expect(writeCallCount).toBe(2);

    sse.dispose();
  });

  it('req.emit("close") synchronously flips the guard and clears the heartbeat (C4-T2)', () => {
    const { res, writes } = makeFakeRes();
    const req = makeFakeReq();

    const sse = createSseWriter(req as unknown as Request, res as unknown as Response);
    // Initial heartbeat tick
    vi.advanceTimersByTime(25_000);
    const initialHeartbeats = writes.filter(w => w.startsWith(': heartbeat')).length;
    expect(initialHeartbeats).toBe(1);

    // Client disconnects
    req.emit('close');
    expect(sse.isClosed()).toBe(true);

    // Subsequent sendEvent no-ops
    sse.sendEvent('progress', { rowsFetched: 5000 });
    expect(writes.some(w => w.includes('rowsFetched":5000'))).toBe(false);

    // Heartbeat tick after close must NOT write
    vi.advanceTimersByTime(25_000);
    const heartbeatsAfterClose = writes.filter(w => w.startsWith(': heartbeat')).length;
    expect(heartbeatsAfterClose).toBe(initialHeartbeats);  // unchanged
  });

  it('heartbeat EPIPE is caught; interval self-clears on next tick (C4-T3)', () => {
    let heartbeatWriteCount = 0;
    const { res } = makeFakeRes((chunk) => {
      if (chunk.startsWith(': heartbeat')) {
        heartbeatWriteCount++;
        throw new Error('EPIPE');
      }
      return true;
    });
    const req = makeFakeReq();

    const sse = createSseWriter(req as unknown as Request, res as unknown as Response);
    vi.advanceTimersByTime(25_000);
    expect(heartbeatWriteCount).toBe(1);
    expect(sse.isClosed()).toBe(true);

    // Next tick — interval was cleared; no second write attempt
    vi.advanceTimersByTime(25_000);
    expect(heartbeatWriteCount).toBe(1);
  });
});
