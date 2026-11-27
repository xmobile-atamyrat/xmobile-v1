// @vitest-environment jsdom

/**
 * Sign-out and sign-in happen without a reload, and the dashboard's SWR
 * cache is the app-wide default one (there is no SWRConfig provider in the
 * app). A SUPERUSER's response, revenue included, must never reach the next
 * account on the same tab.
 */
import type {
  AnalyticsResponse,
  AnalyticsWidgetResult,
} from '@/lib/analytics/metrics/types';
import AnalyticsDashboard from '@/pages/admin/analytics/AnalyticsDashboard';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { clearClientCache, clearSessionOnDevice } from '@/pages/lib/signOut';
import { useUserContext } from '@/pages/lib/UserContext';
import { screen, waitFor } from '@testing-library/react';
import mockRouter from 'next-router-mock';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/UserContext', () => ({ useUserContext: vi.fn() }));
vi.mock('@/pages/lib/fetch', () => ({ useFetchWithCreds: vi.fn() }));
vi.mock('@/pages/lib/fcm/fcmClient', () => ({
  FCM_TOKEN_STORAGE_KEY: 'fcm_token',
  clearRegistration: vi.fn(),
  unregisterFCMToken: vi.fn(),
}));
vi.mock('@mui/x-charts/LineChart', () => ({ LineChart: (): null => null }));

const TODAY = '2026-11-28';
const fetchMock = vi.fn();

const kpi = (
  id: string,
  unit: AnalyticsWidgetResult['unit'],
  labelKey: string,
  value: number,
): AnalyticsWidgetResult => ({
  id,
  kind: 'kpi',
  unit,
  labelKey,
  data: { kind: 'kpi', value, previous: null },
});

const response = (widgets: AnalyticsWidgetResult[]): AnalyticsResponse => ({
  from: '2026-10-30',
  to: TODAY,
  granularity: 'day',
  widgets,
  userCount: 10,
  telekomBalance: null,
});

const superuserResponse = response([
  kpi('kpi_visitors', 'count', 'analyticsVisitors', 1250),
  kpi('kpi_revenue', 'tmt', 'analyticsRevenue', 84500),
]);
const adminResponse = response([
  kpi('kpi_visitors', 'count', 'analyticsVisitors', 1250),
]);

const signedInAs = (id: string, grade: 'ADMIN' | 'SUPERUSER') =>
  vi.mocked(useUserContext).mockReturnValue({
    user: { id, grade } as never,
    setUser: vi.fn(),
    accessToken: `token-${id}`,
    setAccessToken: vi.fn(),
    isLoading: false,
  });

// The app's default SWR cache: no SWRConfig provider, as in production.
const dashboard = () => createElement(AnalyticsDashboard, { today: TODAY });
const renderDashboard = () =>
  renderWithProviders(dashboard(), { locale: 'en' });

const never = () => new Promise(() => {});

describe('AnalyticsDashboard across accounts on one tab', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockRouter.locale = 'en';
    vi.mocked(useFetchWithCreds).mockReturnValue(fetchMock as never);
    await clearClientCache();
  });

  it("doesn't hand a SUPERUSER's cached response to the ADMIN who signs in next", async () => {
    signedInAs('su-1', 'SUPERUSER');
    fetchMock.mockResolvedValue({ success: true, data: superuserResponse });
    const first = renderDashboard();
    await screen.findByText('84,500 TMT');
    first.unmount();

    // Same tab, no reload, and nothing cleared the cache in between.
    signedInAs('admin-1', 'ADMIN');
    fetchMock.mockReset().mockReturnValue(never());
    renderDashboard();

    expect(screen.queryByText('84,500 TMT')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Revenue' })).toBeNull();
    expect(screen.getAllByTestId('analytics-skeleton').length).toBeGreaterThan(
      0,
    );
    // The admin's own request goes out, with the admin's token.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0].accessToken).toBe('token-admin-1');
  });

  it('shows nothing of the previous account while the next one loads in place', async () => {
    signedInAs('su-2', 'SUPERUSER');
    fetchMock.mockResolvedValue({ success: true, data: superuserResponse });
    const view = renderDashboard();
    await screen.findByText('84,500 TMT');

    // keepPreviousData would otherwise show the last key's data.
    signedInAs('admin-2', 'ADMIN');
    let resolve: (value: unknown) => void = () => {};
    fetchMock.mockReset().mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    view.rerender(dashboard());

    expect(screen.queryByText('84,500 TMT')).toBeNull();
    expect(screen.queryByText('1,250')).toBeNull();

    resolve({ success: true, data: adminResponse });
    await screen.findByText('1,250');
    expect(screen.queryByRole('region', { name: 'Revenue' })).toBeNull();
  });

  it('is emptied by sign-out (and account deletion), which share clearSessionOnDevice', async () => {
    signedInAs('su-3', 'SUPERUSER');
    fetchMock.mockResolvedValue({ success: true, data: superuserResponse });
    const first = renderDashboard();
    await screen.findByText('84,500 TMT');
    first.unmount();

    // Without the clear, the same account would get the cached response
    // straight away (and no request within the deduping interval). After it,
    // the dashboard loads afresh rather than sitting empty.
    await clearSessionOnDevice();
    fetchMock.mockReset().mockReturnValue(never());
    renderDashboard();

    expect(screen.queryByText('84,500 TMT')).toBeNull();
    expect(screen.getAllByTestId('analytics-skeleton').length).toBeGreaterThan(
      0,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
