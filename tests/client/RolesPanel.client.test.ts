// @vitest-environment jsdom

import RolesPanel from '@/pages/admin/activity/RolesPanel';
import type { ManagedUser } from '@/pages/lib/adminUsers';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/UserContext', () => ({
  useUserContext: vi.fn(),
}));

vi.mock('@/pages/lib/fetch', () => ({
  useFetchWithCreds: vi.fn(),
}));

const users: ManagedUser[] = [
  {
    id: 'me',
    name: 'Merdan',
    email: 'me@test.local',
    phoneNumber: null,
    grade: 'SUPERUSER',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'u2',
    name: 'Aman',
    email: 'aman@test.local',
    phoneNumber: '+99365000000',
    grade: 'ADMIN',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

const fetchMock = vi.fn();

describe('RolesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUserContext).mockReturnValue({
      user: { id: 'me' } as never,
      setUser: vi.fn(),
      accessToken: 'token',
      setAccessToken: vi.fn(),
      isLoading: false,
    });
    vi.mocked(useFetchWithCreds).mockReturnValue(fetchMock as never);
    fetchMock.mockImplementation(async ({ method, body }) =>
      method === 'GET'
        ? { success: true, data: { items: users, nextCursor: null } }
        : { success: true, data: { id: body.userId, grade: body.grade } },
    );
  });

  it('loads everyone without a filter and locks the viewer out of their own role', async () => {
    renderWithProviders(createElement(RolesPanel, { onRoleChanged: vi.fn() }));

    expect(await screen.findByText('Aman')).toBeTruthy();
    expect(fetchMock.mock.calls[0][0].path).toBe('/api/admin/users');

    expect(screen.queryByRole('button', { name: 'Staff' })).toBeNull();

    const own = screen.getByText('Merdan').closest('li') as HTMLElement;
    expect(within(own).getByText('(you)')).toBeTruthy();
    expect(
      within(own).getByRole('combobox').getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('searches by the debounced, trimmed term', async () => {
    renderWithProviders(createElement(RolesPanel, { onRoleChanged: vi.fn() }));
    await screen.findByText('Aman');

    await userEvent.type(
      screen.getByLabelText('Name, phone or email'),
      '  Aman ',
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ path: '/api/admin/users?q=Aman' }),
      ),
    );
  });

  it('asks before changing a role, then saves it', async () => {
    const onRoleChanged = vi.fn();
    renderWithProviders(createElement(RolesPanel, { onRoleChanged }));
    const row = (await screen.findByText('Aman')).closest('li') as HTMLElement;

    await userEvent.click(within(row).getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: 'Customer' }));

    expect(
      screen.getByText("Change Aman's role from Admin to Customer?"),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onRoleChanged).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'PATCH',
        body: { userId: 'u2', grade: 'FREE' },
      }),
    );
    // The dialog hides the page from the a11y tree until its exit transition ends.
    await waitFor(() =>
      expect(within(row).getByRole('combobox').textContent).toBe('Customer'),
    );
  });
});
