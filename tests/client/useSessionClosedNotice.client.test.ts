// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockUseChatContext = vi.fn();
vi.mock('@/pages/lib/ChatContext', () => ({
  useChatContext: () => mockUseChatContext(),
}));

// eslint-disable-next-line import/first
import { useSessionClosedNotice } from '@/pages/lib/hooks/useSessionClosedNotice';

const withSession = (currentSession: unknown) =>
  mockUseChatContext.mockReturnValue({ currentSession });

describe('useSessionClosedNotice', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens when the active session is closed', () => {
    withSession({ id: 's1', status: 'ACTIVE' });
    const { result, rerender } = renderHook(() =>
      useSessionClosedNotice(false),
    );
    expect(result.current.open).toBe(false);

    withSession({ id: 's1', status: 'CLOSED' });
    rerender();

    expect(result.current.open).toBe(true);
  });

  it('stays closed when mounted with an already closed session', () => {
    withSession({ id: 's1', status: 'CLOSED' });
    const { result, rerender } = renderHook(() =>
      useSessionClosedNotice(false),
    );

    withSession({ id: 's1', status: 'CLOSED' });
    rerender();

    expect(result.current.open).toBe(false);
  });

  it('does not reopen after dismissal when the closed session updates', () => {
    withSession({ id: 's1', status: 'ACTIVE' });
    const { result, rerender } = renderHook(() =>
      useSessionClosedNotice(false),
    );
    withSession({ id: 's1', status: 'CLOSED' });
    rerender();

    act(() => {
      result.current.close();
    });
    withSession({ id: 's1', status: 'CLOSED' });
    rerender();

    expect(result.current.open).toBe(false);
  });

  it('never opens for admins', () => {
    withSession({ id: 's1', status: 'ACTIVE' });
    const { result, rerender } = renderHook(() => useSessionClosedNotice(true));

    withSession({ id: 's1', status: 'CLOSED' });
    rerender();

    expect(result.current.open).toBe(false);
  });
});
