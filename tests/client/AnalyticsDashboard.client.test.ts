// @vitest-environment jsdom

import type {
  AnalyticsResponse,
  AnalyticsWidgetResult,
} from '@/lib/analytics/metrics/types';
import AnalyticsDashboard from '@/pages/admin/analytics/AnalyticsDashboard';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import mockRouter from 'next-router-mock';
import { createElement } from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/UserContext', () => ({ useUserContext: vi.fn() }));
vi.mock('@/pages/lib/fetch', () => ({ useFetchWithCreds: vi.fn() }));

// jsdom can't lay out SVG charts; the stub exposes what the chart was given.
vi.mock('@mui/x-charts/LineChart', async () => {
  const { createElement: h } = await import('react');
  return {
    LineChart: (props: {
      xAxis: { data: string[] }[];
      series: { label: string; data: number[] }[];
      margin?: { right?: number };
    }) =>
      h('div', {
        'data-testid': 'line-chart',
        'data-margin-right': String(props.margin?.right ?? ''),
        'data-x': JSON.stringify(props.xAxis[0].data),
        'data-series': JSON.stringify(
          props.series.map((s) => ({ label: s.label, data: s.data })),
        ),
      }),
  };
});

const TODAY = '2026-11-28';
const fetchMock = vi.fn();

const widget = (
  id: string,
  kind: AnalyticsWidgetResult['kind'],
  unit: AnalyticsWidgetResult['unit'],
  labelKey: string,
  data: AnalyticsWidgetResult['data'],
): AnalyticsWidgetResult => ({ id, kind, unit, labelKey, data });

const staffWidgets = (): AnalyticsWidgetResult[] => [
  widget('kpi_visitors', 'kpi', 'count', 'analyticsVisitors', {
    kind: 'kpi',
    value: 1250,
    previous: 1000,
  }),
  widget('kpi_sessions', 'kpi', 'count', 'analyticsSessions', {
    kind: 'kpi',
    value: 50,
    previous: 100,
  }),
  widget('kpi_pageviews', 'kpi', 'count', 'analyticsPageviews', {
    kind: 'kpi',
    value: 7,
    previous: null,
  }),
  widget('kpi_orders_placed', 'kpi', 'count', 'analyticsOrdersPlaced', {
    kind: 'kpi',
    value: 3,
    previous: 0,
  }),
  widget('kpi_conversion', 'kpi', 'percent', 'analyticsConversionRate', {
    kind: 'kpi',
    value: 2.5,
    previous: 2,
  }),
  widget('traffic', 'timeseries', 'count', 'analyticsTraffic', {
    kind: 'timeseries',
    series: [
      {
        key: 'visitors',
        labelKey: 'analyticsVisitors',
        points: [
          { period: '2026-11-27', value: 5 },
          { period: '2026-11-26', value: 4 },
        ],
      },
      {
        key: 'pageviews_app',
        labelKey: 'analyticsPageviewsApp',
        points: [{ period: '2026-11-28', value: 9 }],
      },
    ],
  }),
  widget('funnel', 'funnel', 'count', 'analyticsFunnel', {
    kind: 'funnel',
    steps: [
      {
        key: 'product_view',
        labelKey: 'analyticsFunnelProductView',
        value: 200,
      },
      { key: 'cart_add', labelKey: 'analyticsFunnelCartAdd', value: 100 },
      {
        key: 'order_placed',
        labelKey: 'analyticsFunnelOrderPlaced',
        value: 25,
      },
      {
        key: 'order_completed',
        labelKey: 'analyticsFunnelOrderCompleted',
        value: 0,
      },
    ],
  }),
  widget('top_products', 'topN', 'count', 'analyticsTopProducts', {
    kind: 'topN',
    rows: [
      {
        key: 'p1',
        label: 'iPhone 16',
        value: 40,
        imageUrl: '/media/p1.webp',
        href: '/product/iphone-16',
      },
      { key: 'p2', label: 'Old phone', value: 10 },
    ],
  }),
  widget('top_searches', 'topN', 'count', 'analyticsTopSearches', {
    kind: 'topN',
    rows: [{ key: 'ru', label: 'ru', value: 3 }],
  }),
  widget(
    'zero_result_searches',
    'topN',
    'count',
    'analyticsZeroResultSearches',
    {
      kind: 'topN',
      rows: [],
    },
  ),
  widget('by_platform', 'topN', 'count', 'analyticsByPlatform', {
    kind: 'topN',
    rows: [
      { key: 'APP', label: 'APP', value: 60 },
      { key: 'WEB', label: 'WEB', value: 40 },
    ],
  }),
  widget('by_locale', 'topN', 'count', 'analyticsByLocale', {
    kind: 'topN',
    rows: [{ key: 'tk', label: 'tk', value: 5 }],
  }),
  widget('by_device', 'topN', 'count', 'analyticsByDevice', {
    kind: 'topN',
    rows: [
      { key: 'mobile', label: 'mobile', value: 8 },
      { key: 'unknown', label: 'unknown', value: 1 },
    ],
  }),
];

const superuserWidgets = (): AnalyticsWidgetResult[] => [
  ...staffWidgets().slice(0, 5),
  widget('kpi_revenue', 'kpi', 'tmt', 'analyticsRevenue', {
    kind: 'kpi',
    value: 84500,
    previous: 80000,
  }),
  widget('kpi_aov', 'kpi', 'tmt', 'analyticsAverageOrderValue', {
    kind: 'kpi',
    value: 1234.6,
    previous: null,
  }),
  widget('revenue', 'timeseries', 'tmt', 'analyticsRevenueOverTime', {
    kind: 'timeseries',
    series: [
      {
        key: 'revenue',
        labelKey: 'analyticsRevenue',
        points: [{ period: '2026-11-01', value: 84500 }],
      },
    ],
  }),
];

const response = (
  widgets: AnalyticsWidgetResult[],
  extra: Partial<AnalyticsResponse> = {},
): AnalyticsResponse => ({
  from: '2026-10-30',
  to: TODAY,
  granularity: 'day',
  widgets,
  userCount: 4321,
  telekomBalance: 150,
  ...extra,
});

const ok = (data: AnalyticsResponse) => ({ success: true, data });

const renderDashboard = () =>
  renderWithProviders(
    createElement(
      SWRConfig,
      { value: { provider: () => new Map(), dedupingInterval: 0 } },
      createElement(AnalyticsDashboard, { today: TODAY }),
    ),
    { locale: 'en' },
  );

const requestedPaths = () =>
  fetchMock.mock.calls.map(([args]) => args.path as string);

const lastQuery = () =>
  new URLSearchParams(requestedPaths().at(-1)?.split('?')[1]);

const card = (name: string) => screen.getByRole('region', { name });

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouter.locale = 'en';
    vi.mocked(useUserContext).mockReturnValue({
      user: { id: 'me', grade: 'ADMIN' } as never,
      setUser: vi.fn(),
      accessToken: 'token',
      setAccessToken: vi.fn(),
      isLoading: false,
    });
    vi.mocked(useFetchWithCreds).mockReturnValue(fetchMock as never);
    fetchMock.mockResolvedValue(ok(response(staffWidgets())));
  });

  it('loads everything in one request for the last 30 days by day', async () => {
    renderDashboard();
    await screen.findByText('1,250');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith({
      accessToken: 'token',
      method: 'GET',
      path: '/api/admin/analytics?from=2026-10-30&to=2026-11-28&granularity=day&locale=en',
    });
    expect(screen.getByTestId('analytics-range').textContent).toBe(
      '30.10.2026 – 28.11.2026',
    );
  });

  it("doesn't request anything without an access token", () => {
    vi.mocked(useUserContext).mockReturnValue({
      user: undefined,
      setUser: vi.fn(),
      accessToken: undefined,
      setAccessToken: vi.fn(),
      isLoading: true,
    });
    renderDashboard();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows skeletons until the response arrives', async () => {
    let resolve: (value: unknown) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    renderDashboard();
    expect(screen.getAllByTestId('analytics-skeleton').length).toBeGreaterThan(
      0,
    );
    resolve(ok(response(staffWidgets())));
    await screen.findByText('1,250');
    expect(screen.queryByTestId('analytics-skeleton')).toBeNull();
  });

  describe('KPI cards', () => {
    it('formats values by unit and shows the change vs the previous period', async () => {
      renderDashboard();
      await screen.findByText('1,250');

      const visitors = card('Visitors');
      expect(within(visitors).getByText('1,250')).toBeTruthy();
      const up = within(visitors).getByTestId('kpi-delta');
      expect(up.dataset.direction).toBe('up');
      expect(up.textContent).toBe('▲ +25% vs previous period');

      const sessions = within(card('Sessions')).getByTestId('kpi-delta');
      expect(sessions.dataset.direction).toBe('down');
      expect(sessions.textContent).toContain('−50%');

      expect(within(card('Page views')).queryByTestId('kpi-delta')).toBeNull();

      // Against 0 a ratio means nothing: show the absolute change.
      expect(
        within(card('Orders placed')).getByTestId('kpi-delta').textContent,
      ).toContain('+3');

      const conversion = card('Conversion rate');
      expect(within(conversion).getByText('2.5%')).toBeTruthy();
      expect(within(conversion).getByTestId('kpi-delta').textContent).toContain(
        '+0.5 pp',
      );
    });

    it('shows the user count and Telekom balance', async () => {
      renderDashboard();
      await screen.findByText('1,250');
      expect(within(card('Total User Count')).getByText('4,321')).toBeTruthy();
      expect(within(card('Telekom Balance')).getByText('150 TMT')).toBeTruthy();
    });

    it('shows a dash when the balance is unknown', async () => {
      fetchMock.mockResolvedValue(
        ok(response(staffWidgets(), { telekomBalance: null })),
      );
      renderDashboard();
      await screen.findByText('1,250');
      expect(within(card('Telekom Balance')).getByText('—')).toBeTruthy();
    });

    it('formats TMT for a superuser and badges superuser-only widgets', async () => {
      fetchMock.mockResolvedValue(ok(response(superuserWidgets())));
      renderDashboard();
      await screen.findByText('84,500 TMT');

      expect(within(card('Revenue')).getByTestId('kpi-delta').textContent).toBe(
        '▲ +5.6% vs previous period',
      );
      expect(
        within(card('Average order value')).getByText('1,235 TMT'),
      ).toBeTruthy();
      expect(
        within(card('Revenue over time')).getByText('Superuser only'),
      ).toBeTruthy();
    });

    it('renders only what an admin gets back: no revenue widgets', async () => {
      renderDashboard();
      await screen.findByText('1,250');
      expect(screen.queryByRole('region', { name: 'Revenue' })).toBeNull();
      expect(
        screen.queryByRole('region', { name: 'Revenue over time' }),
      ).toBeNull();
      expect(screen.queryByText('Superuser only')).toBeNull();
    });
  });

  describe('charts', () => {
    it('plots every series on one shared, sorted axis', async () => {
      renderDashboard();
      const traffic = await screen.findByRole('region', { name: 'Traffic' });
      const chart = await within(traffic).findByTestId('line-chart');

      expect(JSON.parse(chart.dataset.x ?? '')).toEqual([
        '2026-11-26',
        '2026-11-27',
        '2026-11-28',
      ]);
      expect(JSON.parse(chart.dataset.series ?? '')).toEqual([
        { label: 'Visitors', data: [4, 5, 0] },
        { label: 'Page views (app)', data: [0, 0, 9] },
      ]);
      expect(
        within(traffic)
          .getAllByTestId('series-legend')
          .map((item) => item.textContent),
      ).toEqual(['Visitors', 'Page views (app)']);
    });

    it('leaves room for the last x-axis label', async () => {
      renderDashboard();
      const traffic = await screen.findByRole('region', { name: 'Traffic' });
      const chart = await within(traffic).findByTestId('line-chart');
      // Half of a centred "11.2026" label at 12px.
      expect(Number(chart.dataset.marginRight)).toBeGreaterThanOrEqual(32);
    });

    it('notes that a last point covering today is still in progress', async () => {
      renderDashboard();
      const traffic = await screen.findByRole('region', { name: 'Traffic' });
      expect(
        within(traffic).getByTestId('partial-period-note').textContent,
      ).toBe("The last point includes today, which isn't over yet.");
    });

    it('adds no note when the chart ends before today', async () => {
      const widgets = staffWidgets().map((w) =>
        w.id === 'traffic'
          ? {
              ...w,
              data: {
                kind: 'timeseries' as const,
                series: [
                  {
                    key: 'visitors',
                    labelKey: 'analyticsVisitors',
                    points: [{ period: '2026-11-27', value: 5 }],
                  },
                ],
              },
            }
          : w,
      );
      fetchMock.mockResolvedValue(ok(response(widgets)));
      renderDashboard();
      const traffic = await screen.findByRole('region', { name: 'Traffic' });
      await within(traffic).findByTestId('line-chart');
      expect(within(traffic).queryByTestId('partial-period-note')).toBeNull();
    });

    it('notes the current week by its Monday', async () => {
      const widgets = staffWidgets().map((w) =>
        w.id === 'traffic'
          ? {
              ...w,
              data: {
                kind: 'timeseries' as const,
                series: [
                  {
                    key: 'visitors',
                    labelKey: 'analyticsVisitors',
                    points: [
                      { period: '2026-11-16', value: 30 },
                      { period: '2026-11-23', value: 12 },
                    ],
                  },
                ],
              },
            }
          : w,
      );
      fetchMock.mockResolvedValue(
        ok(response(widgets, { granularity: 'week' })),
      );
      renderDashboard();
      const traffic = await screen.findByRole('region', { name: 'Traffic' });
      expect(within(traffic).getByTestId('partial-period-note')).toBeTruthy();
    });

    it('says so when a chart has no points', async () => {
      const widgets = staffWidgets().map((w) =>
        w.id === 'traffic'
          ? { ...w, data: { kind: 'timeseries' as const, series: [] } }
          : w,
      );
      fetchMock.mockResolvedValue(ok(response(widgets)));
      renderDashboard();
      const traffic = await screen.findByRole('region', { name: 'Traffic' });
      expect(
        within(traffic).getByText('No data for this period yet.'),
      ).toBeTruthy();
      expect(within(traffic).queryByTestId('line-chart')).toBeNull();
    });
  });

  describe('funnel', () => {
    it('shows each step with its count and the conversion from the step before', async () => {
      renderDashboard();
      const funnel = await screen.findByRole('region', {
        name: 'Purchase funnel',
      });
      const steps = within(funnel).getAllByTestId('funnel-step');
      expect(steps).toHaveLength(4);
      expect(steps[0].textContent).toBe('Viewed a product200');
      expect(steps[1].textContent).toContain('Added to cart100');
      expect(steps[1].textContent).toContain('50% of the previous step');
      expect(steps[2].textContent).toContain('25% of the previous step');
      expect(steps[3].textContent).toContain('0% of the previous step');
      expect(within(funnel).getByText('Overall conversion: 0%')).toBeTruthy();
    });

    it('shows a dash for a step after an empty one, and no data for an empty funnel', async () => {
      const withSteps = (values: number[]) =>
        staffWidgets().map((w) =>
          w.id === 'funnel'
            ? {
                ...w,
                data: {
                  kind: 'funnel' as const,
                  steps: values.map((value, i) => ({
                    key: `s${i}`,
                    labelKey: 'analyticsFunnelCartAdd',
                    value,
                  })),
                },
              }
            : w,
        );

      fetchMock.mockResolvedValue(ok(response(withSteps([10, 0, 0]))));
      const { unmount } = renderDashboard();
      let funnel = await screen.findByRole('region', {
        name: 'Purchase funnel',
      });
      expect(
        within(funnel).getAllByTestId('funnel-step')[2].textContent,
      ).toContain('— of the previous step');
      unmount();

      fetchMock.mockResolvedValue(ok(response(withSteps([0, 0]))));
      renderDashboard();
      funnel = await screen.findByRole('region', { name: 'Purchase funnel' });
      expect(
        within(funnel).getByText('No data for this period yet.'),
      ).toBeTruthy();
    });
  });

  describe('top lists', () => {
    it('lists rows with value, image and link', async () => {
      renderDashboard();
      const top = await screen.findByRole('region', {
        name: 'Most viewed products',
      });
      const rows = within(top).getAllByTestId('topn-row');
      expect(rows).toHaveLength(2);
      const link = within(rows[0]).getByRole('link', { name: 'iPhone 16' });
      expect(link.getAttribute('href')).toBe('/product/iphone-16');
      expect(rows[0].querySelector('img')?.getAttribute('src')).toBe(
        '/media/p1.webp',
      );
      expect(within(rows[0]).getByText('40')).toBeTruthy();
      expect(within(rows[1]).queryByRole('link')).toBeNull();
      expect(rows[1].querySelector('img')).toBeNull();
    });

    it('translates breakdown values but leaves search terms alone', async () => {
      renderDashboard();
      const platform = await screen.findByRole('region', {
        name: 'By platform',
      });
      expect(
        within(platform)
          .getAllByTestId('topn-row')
          .map((row) => row.textContent),
      ).toEqual(['1App60', '2Website40']);
      expect(within(card('By language')).getByText('Turkmen')).toBeTruthy();
      const device = card('By device');
      expect(within(device).getByText('Phone')).toBeTruthy();
      expect(within(device).getByText('Unknown')).toBeTruthy();
      expect(within(card('Top searches')).getByText('ru')).toBeTruthy();
    });

    it('says so when a list is empty', async () => {
      renderDashboard();
      const zero = await screen.findByRole('region', {
        name: 'Searches with no results',
      });
      expect(
        within(zero).getByText('No data for this period yet.'),
      ).toBeTruthy();
    });
  });

  it('shows an error in each failed widget and the rest as usual', async () => {
    const failed = new Set(['kpi_sessions', 'traffic', 'top_products']);
    fetchMock.mockResolvedValue(
      ok(
        response(
          staffWidgets().map((w) =>
            failed.has(w.id) ? { ...w, data: null } : w,
          ),
        ),
      ),
    );
    renderDashboard();
    await screen.findByText('1,250');

    expect(within(card('Sessions')).getByRole('alert').textContent).toBe(
      'Could not load this block.',
    );
    expect(within(card('Traffic')).getByRole('alert')).toBeTruthy();
    expect(
      within(card('Most viewed products')).getByRole('alert'),
    ).toBeTruthy();
    expect(within(card('Visitors')).queryByRole('alert')).toBeNull();
    expect(within(card('By platform')).getAllByTestId('topn-row')).toHaveLength(
      2,
    );
  });

  it('shows a retry when the whole request fails', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({ success: false, message: 'Forbidden' });
    renderDashboard();

    expect(
      await screen.findByText('Could not load analytics. Please try again.'),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await screen.findByText('1,250');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByText('Could not load analytics. Please try again.'),
    ).toBeNull();
  });

  describe('controls', () => {
    it('requests a preset range once per click', async () => {
      const user = userEvent.setup();
      renderDashboard();
      await screen.findByText('1,250');

      await user.click(screen.getByRole('button', { name: '7 days' }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      expect(lastQuery().get('from')).toBe('2026-11-22');
      expect(lastQuery().get('to')).toBe(TODAY);
      expect(
        screen
          .getByRole('button', { name: '7 days' })
          .getAttribute('aria-pressed'),
      ).toBe('true');

      await user.click(screen.getByRole('button', { name: '12 months' }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
      expect(lastQuery().get('from')).toBe('2025-11-29');

      await user.click(screen.getByRole('button', { name: '90 days' }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
      expect(lastQuery().get('from')).toBe('2026-08-31');
    });

    it('changes the granularity', async () => {
      const user = userEvent.setup();
      renderDashboard();
      await screen.findByText('1,250');

      await user.click(screen.getByRole('button', { name: 'Week' }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      expect(lastQuery().get('granularity')).toBe('week');

      await user.click(screen.getByRole('button', { name: 'Month' }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
      expect(lastQuery().get('granularity')).toBe('month');
      expect(lastQuery().get('from')).toBe('2026-10-30');
    });

    it('takes a custom range, and holds off while it is invalid', async () => {
      const user = userEvent.setup();
      renderDashboard();
      await screen.findByText('1,250');

      await user.click(screen.getByRole('button', { name: 'Custom' }));
      const from = screen.getByTestId('analytics-from') as HTMLInputElement;
      const to = screen.getByTestId('analytics-to') as HTMLInputElement;
      expect(from.value).toBe('2026-10-30');
      expect(to.value).toBe(TODAY);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      fireEvent.change(from, { target: { value: '2026-12-01' } });
      expect(
        screen.getByText('The start date must not be after the end date.'),
      ).toBeTruthy();

      fireEvent.change(from, { target: { value: '2020-01-01' } });
      expect(
        screen.getByText('Pick a period of at most two years.'),
      ).toBeTruthy();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      fireEvent.change(from, { target: { value: '2026-11-01' } });
      fireEvent.change(to, { target: { value: '2026-11-15' } });
      await waitFor(() => expect(lastQuery().get('to')).toBe('2026-11-15'));
      expect(lastQuery().get('from')).toBe('2026-11-01');
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});
