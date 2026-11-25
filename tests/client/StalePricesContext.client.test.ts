// @vitest-environment jsdom

import StalePricesContextProvider, {
  useStalePrices,
} from '@/pages/lib/StalePricesContext';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import { render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/pages/lib/UserContext', () => ({ useUserContext: vi.fn() }));
vi.mock('@/pages/lib/fetch', () => ({ useFetchWithCreds: vi.fn() }));

function Probe() {
  const { staleCount, staleByProductId } = useStalePrices();
  return createElement(
    'span',
    { 'data-testid': 'probe' },
    `${staleCount}:${Object.keys(staleByProductId).join(',')}`,
  );
}

const renderProvider = () =>
  render(createElement(StalePricesContextProvider, null, createElement(Probe)));

describe('StalePricesContext', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({
      success: true,
      data: { p1: { tier: 'red', days: 95 }, p2: { tier: 'orange', days: 31 } },
    });
    vi.mocked(useFetchWithCreds).mockReturnValue(fetchMock as never);
  });

  it('loads the stale list once for an admin', async () => {
    vi.mocked(useUserContext).mockReturnValue({
      user: { id: 'u1', grade: 'ADMIN' },
      accessToken: 'token',
    } as never);
    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId('probe')).toHaveTextContent('2:p1,p2'),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith({
      accessToken: 'token',
      path: '/api/prices/stale',
      method: 'GET',
    });
  });

  it('never asks for a customer', async () => {
    vi.mocked(useUserContext).mockReturnValue({
      user: { id: 'u2', grade: 'FREE' },
      accessToken: 'token',
    } as never);
    renderProvider();

    expect(screen.getByTestId('probe')).toHaveTextContent('0:');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never asks for a guest', () => {
    vi.mocked(useUserContext).mockReturnValue({
      user: undefined,
      accessToken: undefined,
    } as never);
    renderProvider();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
