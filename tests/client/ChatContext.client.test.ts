// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseUserContext = vi.fn();
vi.mock('@/pages/lib/UserContext', () => ({
  useUserContext: () => mockUseUserContext(),
}));

const wsState = { isConnected: true };
const mockSend = vi.fn();
const handlers = new Map<string, Set<(data: unknown) => void>>();
const mockSubscribe = (type: string, handler: (data: unknown) => void) => {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type)!.add(handler);
  return () => {
    handlers.get(type)?.delete(handler);
  };
};
vi.mock('@/pages/lib/WebSocketContext', () => ({
  useWebSocketContext: () => ({
    isConnected: wsState.isConnected,
    send: mockSend,
    subscribe: mockSubscribe,
  }),
}));

// eslint-disable-next-line import/first
import { ChatContextProvider, useChatContext } from '@/pages/lib/ChatContext';

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(ChatContextProvider, null, children);

const session = (id: string, status = 'ACTIVE') =>
  ({ id, status, users: [] }) as never;

const respondWith = (data: unknown) =>
  vi.fn().mockResolvedValue({ json: async () => ({ success: true, data }) });

describe('ChatContextProvider', () => {
  beforeEach(() => {
    wsState.isConnected = true;
    handlers.clear();
    mockUseUserContext.mockReturnValue({
      user: { id: 'user-a', grade: 'FREE' },
      accessToken: 'token-a',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('joins a session loaded moments earlier, before a re-render', async () => {
    vi.stubGlobal('fetch', respondWith([session('s1')]));
    const { result } = renderHook(() => useChatContext(), { wrapper });

    let joined = false;
    await act(async () => {
      const { loadSessions, joinSession } = result.current;
      await loadSessions();
      joined = await joinSession('s1');
    });

    expect(joined).toBe(true);
    expect(result.current.currentSession?.id).toBe('s1');
  });

  it('fetches sessions when joining one it has not loaded yet', async () => {
    vi.stubGlobal('fetch', respondWith([session('s1')]));
    const { result } = renderHook(() => useChatContext(), { wrapper });

    let joined = false;
    await act(async () => {
      joined = await result.current.joinSession('s1');
    });

    expect(joined).toBe(true);
    expect(mockSend).toHaveBeenCalledWith({
      type: 'get_messages',
      sessionId: 's1',
      cursorId: undefined,
    });
  });

  it('reports a session that does not exist', async () => {
    vi.stubGlobal('fetch', respondWith([session('s1')]));
    const { result } = renderHook(() => useChatContext(), { wrapper });

    let joined = true;
    await act(async () => {
      joined = await result.current.joinSession('missing');
    });

    expect(joined).toBe(false);
  });

  it('starts a new session without the previous session messages', async () => {
    vi.stubGlobal('fetch', respondWith(session('s2')));
    const { result } = renderHook(() => useChatContext(), { wrapper });

    act(() => {
      result.current.setCurrentSession(session('s1', 'CLOSED'));
      result.current.setMessages([
        { type: 'message', messageId: 'old', content: 'old' } as never,
      ]);
    });
    await act(async () => {
      await result.current.createSession();
    });

    expect(result.current.currentSession?.id).toBe('s2');
    expect(result.current.messages).toEqual([]);
  });

  const reconnect = async (rerender: () => void, whileOffline?: () => void) => {
    wsState.isConnected = false;
    rerender();
    whileOffline?.();
    mockSend.mockClear();
    wsState.isConnected = true;
    await act(async () => {
      rerender();
    });
  };

  it('refetches the open session after the socket reconnects', async () => {
    vi.stubGlobal('fetch', respondWith([session('s1')]));
    const { result, rerender } = renderHook(() => useChatContext(), {
      wrapper,
    });
    act(() => {
      result.current.setCurrentSession(session('s1'));
    });

    await reconnect(rerender);

    expect(mockSend).toHaveBeenCalledWith({
      type: 'get_messages',
      sessionId: 's1',
    });
  });

  it('marks the open session closed if it was closed while offline', async () => {
    const { result, rerender } = renderHook(() => useChatContext(), {
      wrapper,
    });
    act(() => {
      result.current.setCurrentSession(session('s1'));
      result.current.setMessages([
        { type: 'message', messageId: 'm1', content: 'hi' } as never,
      ]);
    });

    await reconnect(rerender, () => {
      vi.stubGlobal('fetch', respondWith([]));
    });

    expect(result.current.currentSession?.status).toBe('CLOSED');
    expect(result.current.messages).toEqual([]);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('keeps the open session and still refetches it when the resync request fails', async () => {
    const { result, rerender } = renderHook(() => useChatContext(), {
      wrapper,
    });
    act(() => {
      result.current.setCurrentSession(session('s1'));
    });

    await reconnect(rerender, () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    });

    expect(result.current.currentSession?.status).toBe('ACTIVE');
    expect(mockSend).toHaveBeenCalledWith({
      type: 'get_messages',
      sessionId: 's1',
    });
  });

  it('still reloads a closed session for an admin', async () => {
    mockUseUserContext.mockReturnValue({
      user: { id: 'admin', grade: 'ADMIN' },
      accessToken: 'token-admin',
    });
    vi.stubGlobal('fetch', respondWith([session('s1', 'CLOSED')]));
    const { result, rerender } = renderHook(() => useChatContext(), {
      wrapper,
    });
    act(() => {
      result.current.setCurrentSession(session('s1'));
    });

    await reconnect(rerender);

    expect(result.current.currentSession?.status).toBe('CLOSED');
    expect(mockSend).toHaveBeenCalledWith({
      type: 'get_messages',
      sessionId: 's1',
    });
  });

  it('does not refetch on the first connection', () => {
    vi.stubGlobal('fetch', respondWith([]));
    wsState.isConnected = false;
    const { rerender } = renderHook(() => useChatContext(), { wrapper });

    wsState.isConnected = true;
    rerender();

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('stops showing a message as sending when the socket drops', () => {
    vi.stubGlobal('fetch', respondWith([]));
    const { result, rerender } = renderHook(() => useChatContext(), {
      wrapper,
    });
    act(() => {
      result.current.setCurrentSession(session('s1'));
    });
    act(() => {
      result.current.sendMessage('hello');
    });
    expect(result.current.isSendingMessage).toBe(true);

    wsState.isConnected = false;
    rerender();

    expect(result.current.isSendingMessage).toBe(false);
  });
});
