import { describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';

import type { InAppNotification } from '@/pages/lib/types';
import { sendMessage, sendNotificationsToUser } from '@/ws-server/lib/utils';
import type { AuthenticatedConnection } from '@/ws-server/lib/types';

describe('sendMessage', () => {
  it('does nothing when the socket is not open', () => {
    const send = vi.fn();
    const conn = {
      readyState: WebSocket.CLOSING,
      send,
    } as unknown as AuthenticatedConnection;

    sendMessage(conn, { type: 'ack', success: true } as any);
    expect(send).not.toHaveBeenCalled();
  });

  it('JSON-stringifies the payload when open', () => {
    const send = vi.fn();
    const conn = {
      readyState: WebSocket.OPEN,
      send,
    } as unknown as AuthenticatedConnection;

    sendMessage(conn, { type: 'ping' } as any);
    expect(send).toHaveBeenCalledWith(JSON.stringify({ type: 'ping' }));
  });
});

describe('sendNotificationsToUser', () => {
  it('returns 0 when the user has no connections', () => {
    const map = new Map<string, Set<AuthenticatedConnection>>();
    const n: InAppNotification[] = [{ id: '1' } as InAppNotification];
    expect(sendNotificationsToUser(map, 'u1', n)).toBe(0);
  });

  it('counts unique notifications delivered to at least one connection', () => {
    const send = vi.fn();
    const conn = {
      readyState: WebSocket.OPEN,
      send,
    } as unknown as AuthenticatedConnection;
    const set = new Set<AuthenticatedConnection>([conn]);
    const map = new Map([['user-1', set]]);

    const notes = [
      { id: 'a' } as InAppNotification,
      { id: 'b' } as InAppNotification,
    ];

    expect(sendNotificationsToUser(map, 'user-1', notes)).toBe(2);
    expect(send).toHaveBeenCalled();
  });
});
