// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseUserContext = vi.fn();
vi.mock('@/pages/lib/UserContext', () => ({
  useUserContext: () => mockUseUserContext(),
}));

// eslint-disable-next-line import/first
import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  useWebSocketContext,
  WebSocketContextProvider,
} from '@/pages/lib/WebSocketContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let createdSockets: any[] = [];

class FakeWebSocket {
  static CONNECTING = 0;

  static OPEN = 1;

  static CLOSING = 2;

  static CLOSED = 3;

  url: string;

  readyState = FakeWebSocket.CONNECTING;

  onopen: (() => void) | null = null;

  onclose: ((event: { code: number; reason: string }) => void) | null = null;

  onmessage: ((event: { data: string }) => void) | null = null;

  onerror: ((event: unknown) => void) | null = null;

  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    createdSockets.push(this);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSING;
  }

  // Test helpers simulating async network events
  triggerOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  triggerClose(code: number) {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code, reason: '' });
  }
}

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(WebSocketContextProvider, null, children);

describe('WebSocketContextProvider', () => {
  beforeEach(() => {
    createdSockets = [];
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('ignores a stale reconnect from a socket superseded by a user switch', () => {
    mockUseUserContext.mockReturnValue({
      user: { id: 'user-a' },
      accessToken: 'token-a',
    });

    const { result, rerender } = renderHook(() => useWebSocketContext(), {
      wrapper,
    });

    expect(createdSockets).toHaveLength(1);
    const socketA = createdSockets[0];
    expect(socketA.url).toContain('token-a');

    act(() => {
      socketA.triggerOpen();
    });
    expect(result.current.isConnected).toBe(true);

    // User signs in as a different user: provider must tear down socketA
    // and open a fresh socket authenticated with the new token.
    mockUseUserContext.mockReturnValue({
      user: { id: 'user-b' },
      accessToken: 'token-b',
    });
    act(() => {
      rerender();
    });

    expect(createdSockets).toHaveLength(2);
    const socketB = createdSockets[1];
    expect(socketB.url).toContain('token-b');
    // socketB hasn't finished its handshake yet - this is the exact window
    // where a stale reconnect could win the race and overwrite wsRef.
    expect(socketB.readyState).toBe(FakeWebSocket.CONNECTING);

    // socketA's close event arrives from the network before socketB opens.
    // Its stale closure must not reconnect using user A's outdated token.
    act(() => {
      socketA.triggerClose(1006);
    });

    // Let the (buggy) reconnect backoff timer fire, if one was scheduled.
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(createdSockets).toHaveLength(2);
  });

  it('keeps retrying with backoff capped at 30s instead of giving up', () => {
    mockUseUserContext.mockReturnValue({
      user: { id: 'user-a' },
      accessToken: 'token-a',
    });
    renderHook(() => useWebSocketContext(), { wrapper });

    const failLatestAndWait = () => {
      act(() => {
        createdSockets[createdSockets.length - 1].triggerClose(1006);
      });
      act(() => {
        vi.advanceTimersByTime(30000);
      });
    };
    Array.from({ length: 8 }).forEach(failLatestAndWait);

    expect(createdSockets).toHaveLength(9);
  });

  it('reconnects immediately when the browser comes back online', () => {
    mockUseUserContext.mockReturnValue({
      user: { id: 'user-a' },
      accessToken: 'token-a',
    });
    const { result } = renderHook(() => useWebSocketContext(), { wrapper });

    act(() => {
      createdSockets[0].triggerOpen();
    });
    act(() => {
      createdSockets[0].triggerClose(1006);
    });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(createdSockets).toHaveLength(2);

    act(() => {
      createdSockets[1].triggerOpen();
    });
    expect(result.current.isConnected).toBe(true);

    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(createdSockets).toHaveLength(2);
  });

  it('does not open a second socket while one is already connecting', () => {
    mockUseUserContext.mockReturnValue({
      user: { id: 'user-a' },
      accessToken: 'token-a',
    });
    renderHook(() => useWebSocketContext(), { wrapper });

    act(() => {
      window.dispatchEvent(new Event('online'));
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(createdSockets).toHaveLength(1);
  });
  describe('heartbeat', () => {
    const openSocket = () => {
      mockUseUserContext.mockReturnValue({
        user: { id: 'user-a' },
        accessToken: 'token-a',
      });
      const hook = renderHook(() => useWebSocketContext(), { wrapper });
      act(() => {
        createdSockets[0].triggerOpen();
      });
      return hook;
    };
    const pings = (socket: { sentMessages: string[] }) =>
      socket.sentMessages.filter((m) => JSON.parse(m).type === 'ping');

    it('pings the server on an interval', () => {
      openSocket();

      act(() => {
        vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
      });

      expect(pings(createdSockets[0])).toHaveLength(1);
    });

    it('keeps the socket when the server answers', () => {
      const { result } = openSocket();

      act(() => {
        vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
      });
      act(() => {
        createdSockets[0].onmessage({ data: JSON.stringify({ type: 'pong' }) });
      });
      act(() => {
        vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS);
      });

      expect(result.current.isConnected).toBe(true);
      expect(createdSockets).toHaveLength(1);
    });

    it('does not pass pongs to subscribers', () => {
      const { result } = openSocket();
      const handler = vi.fn();
      act(() => {
        result.current.subscribe('pong', handler);
      });

      act(() => {
        createdSockets[0].onmessage({ data: JSON.stringify({ type: 'pong' }) });
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('drops a silent socket and reconnects', () => {
      const { result } = openSocket();

      act(() => {
        vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS + HEARTBEAT_TIMEOUT_MS);
      });

      expect(result.current.isConnected).toBe(false);
      expect(createdSockets[0].readyState).toBe(FakeWebSocket.CLOSING);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(createdSockets).toHaveLength(2);

      act(() => {
        createdSockets[0].triggerClose(1006);
        vi.advanceTimersByTime(30000);
      });
      expect(createdSockets).toHaveLength(2);
    });

    it('probes an open socket when the page becomes visible', () => {
      openSocket();

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(pings(createdSockets[0])).toHaveLength(1);
      expect(createdSockets).toHaveLength(1);
    });
  });
});
