// @vitest-environment jsdom

import ActivityFeed from '@/pages/admin/activity/ActivityFeed';
import ActivityHeatmap from '@/pages/admin/activity/ActivityHeatmap';
import StaffCards from '@/pages/admin/activity/StaffCards';
import type { ActivityRow, StaffMember } from '@/pages/lib/adminActivity';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

const staff: StaffMember[] = [
  {
    id: 'a1',
    name: 'Aman',
    lastSeenAt: new Date().toISOString(),
    online: true,
    totalChanges: 42,
    customersAnswered: 7,
  },
  {
    id: 'a2',
    name: 'Bahar',
    lastSeenAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    online: false,
    totalChanges: 3,
    customersAnswered: 0,
  },
  {
    id: 'a3',
    name: 'Chary',
    lastSeenAt: null,
    online: false,
    totalChanges: 0,
    customersAnswered: 0,
  },
];

describe('StaffCards', () => {
  it('shows presence, last seen and the two totals for each admin', () => {
    renderWithProviders(
      createElement(StaffCards, {
        staff,
        selectedId: undefined,
        onSelect: vi.fn(),
      }),
    );

    const aman = screen.getByRole('button', { name: /Aman/ });
    expect(within(aman).getByText('Online')).toBeTruthy();
    expect(within(aman).getByText('42')).toBeTruthy();
    expect(within(aman).getByText('7')).toBeTruthy();
    expect(within(aman).getByText('Changes')).toBeTruthy();
    expect(within(aman).getByText('Customers answered')).toBeTruthy();

    const bahar = screen.getByRole('button', { name: /Bahar/ });
    expect(within(bahar).getByText('Last seen 5 min ago')).toBeTruthy();

    const chary = screen.getByRole('button', { name: /Chary/ });
    expect(within(chary).getByText('Never seen')).toBeTruthy();
  });

  it('selects an admin on click and deselects on a second click', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { rerender } = renderWithProviders(
      createElement(StaffCards, { staff, selectedId: undefined, onSelect }),
    );

    await user.click(screen.getByRole('button', { name: /Bahar/ }));
    expect(onSelect).toHaveBeenLastCalledWith('a2');

    rerender(createElement(StaffCards, { staff, selectedId: 'a2', onSelect }));
    const selected = screen.getByRole('button', { name: /Bahar/ });
    expect(selected.getAttribute('aria-pressed')).toBe('true');
    await user.click(selected);
    expect(onSelect).toHaveBeenLastCalledWith(undefined);
  });
});

describe('ActivityHeatmap', () => {
  const props = {
    name: 'Aman',
    from: '2026-10-05',
    to: '2026-10-11',
    days: [{ date: '2026-10-06', changes: 5, chats: 2 }],
  };

  it('renders one cell per day with a readable tooltip', () => {
    renderWithProviders(
      createElement(ActivityHeatmap, {
        ...props,
        selectedDay: undefined,
        onSelectDay: vi.fn(),
      }),
    );

    expect(screen.getByText('Daily activity: Aman')).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: '06.10.2026: changes 5, customers answered 2',
      }),
    ).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(7);
    expect(screen.getByText('Click a day to filter the feed')).toBeTruthy();
  });

  it('picks a day on click and clears it on a second click', async () => {
    const user = userEvent.setup();
    const onSelectDay = vi.fn();
    const { rerender } = renderWithProviders(
      createElement(ActivityHeatmap, {
        ...props,
        selectedDay: undefined,
        onSelectDay,
      }),
    );

    const name = '06.10.2026: changes 5, customers answered 2';
    await user.click(screen.getByRole('button', { name }));
    expect(onSelectDay).toHaveBeenLastCalledWith('2026-10-06');

    rerender(
      createElement(ActivityHeatmap, {
        ...props,
        selectedDay: '2026-10-06',
        onSelectDay,
      }),
    );
    const cell = screen.getByRole('button', { name });
    expect(cell.getAttribute('aria-pressed')).toBe('true');
    await user.click(cell);
    expect(onSelectDay).toHaveBeenLastCalledWith(undefined);
  });
});

describe('ActivityFeed', () => {
  const rows: ActivityRow[] = [
    {
      id: 'r1',
      userId: 'a1',
      userName: 'Aman',
      entity: 'PRICE',
      action: 'UPDATE',
      targetId: 'p1',
      meta: {
        name: '128gb Black',
        changes: { price: { from: '340', to: '355' } },
      },
      createdAt: '2026-03-01T20:00:00.000Z',
    },
    {
      id: 'r2',
      userId: null,
      userName: 'Old Admin',
      entity: 'BRAND',
      action: 'CREATE',
      targetId: 'b1',
      meta: { name: 'Apple' },
      createdAt: '2026-03-01T10:00:00.000Z',
    },
  ];

  const baseProps = {
    staff,
    filters: {},
    onFiltersChange: vi.fn(),
    items: rows,
    loading: false,
    hasMore: false,
    onLoadMore: vi.fn(),
  };

  it('renders each row as a plain sentence with local time', () => {
    renderWithProviders(createElement(ActivityFeed, baseProps));

    expect(screen.getByText('02.03.2026 01:00')).toBeTruthy();
    expect(
      screen.getByText(
        /Edited price 128gb Black: price \(USD\): \$340 → \$355/,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/Added brand Apple/)).toBeTruthy();
    expect(
      screen.getByText('(account removed)', { exact: false }),
    ).toBeTruthy();
  });

  it('shows the empty state only when nothing is loading', () => {
    const { rerender } = renderWithProviders(
      createElement(ActivityFeed, { ...baseProps, items: [] }),
    );
    expect(screen.getByText('No activity for these filters.')).toBeTruthy();

    rerender(
      createElement(ActivityFeed, { ...baseProps, items: [], loading: true }),
    );
    expect(screen.queryByText('No activity for these filters.')).toBeNull();
  });

  it('loads more on demand', async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    renderWithProviders(
      createElement(ActivityFeed, { ...baseProps, hasMore: true, onLoadMore }),
    );
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('offers a reset only while a filter is set, and clears them all', async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    const { rerender } = renderWithProviders(
      createElement(ActivityFeed, { ...baseProps, onFiltersChange }),
    );
    expect(screen.queryByRole('button', { name: 'Clear Filters' })).toBeNull();

    rerender(
      createElement(ActivityFeed, {
        ...baseProps,
        onFiltersChange,
        filters: { userId: 'a1', from: '2026-03-01', to: '2026-03-01' },
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(onFiltersChange).toHaveBeenCalledWith({});
  });

  it('merges a new date into the existing filters', async () => {
    const onFiltersChange = vi.fn();
    renderWithProviders(
      createElement(ActivityFeed, {
        ...baseProps,
        onFiltersChange,
        filters: { userId: 'a1' },
      }),
    );
    const from = screen.getByLabelText('From') as HTMLInputElement;
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(from, { target: { value: '2026-03-01' } });
    expect(onFiltersChange).toHaveBeenCalledWith({
      userId: 'a1',
      from: '2026-03-01',
    });
  });
});
