// @vitest-environment jsdom

import CustomAppBar from '@/pages/components/Appbar';
import { useSaleAvailability } from '@/pages/lib/hooks/useSaleAvailability';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import mockRouter from 'next-router-mock';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/CategoryContext', () => ({
  useCategoryContext: vi.fn(),
}));

vi.mock('@/pages/lib/ProductContext', () => ({
  useProductContext: vi.fn(),
}));

vi.mock('@/pages/lib/UserContext', () => ({
  useUserContext: vi.fn(),
}));

vi.mock('@/pages/lib/hooks/useSaleAvailability', () => ({
  useSaleAvailability: vi.fn(() => false),
}));

vi.mock('@/pages/lib/PlatformContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/pages/lib/PlatformContext')>()),
  usePlatform: vi.fn(),
}));

vi.mock('@/pages/components/CategoryMegaMenu', () => ({
  default: (): null => null,
}));

vi.mock('@/pages/components/NotificationMenu', () => ({
  default: (): null => null,
}));

const setUser = (user: unknown) =>
  vi.mocked(useUserContext).mockReturnValue({
    user,
    setUser: vi.fn(),
    accessToken: '',
    setAccessToken: vi.fn(),
    isLoading: false,
  } as never);

const renderHeader = () =>
  renderWithProviders(createElement(CustomAppBar, { showHomeHeader: true }));

describe('mobile home header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouter.setCurrentUrl('/');
    mockRouter.locale = 'en';
    vi.mocked(usePlatform).mockReturnValue('mobile');
    vi.mocked(useCategoryContext).mockReturnValue({
      categories: [],
      setSelectedCategoryId: vi.fn(),
    } as never);
    vi.mocked(useProductContext).mockReturnValue({
      setProducts: vi.fn(),
      searchKeyword: '',
      setSearchKeyword: vi.fn(),
    } as never);
  });

  it('shows the logo without greeting, sign-in or bell for a guest', () => {
    setUser(undefined);
    renderHeader();

    expect(screen.getByAltText('Xmobile')).toBeTruthy();
    expect(screen.queryByText('Sign in')).toBeNull();
    expect(screen.queryByLabelText('notifications')).toBeNull();
  });

  it('shows the logo and the bell for a signed-in user', () => {
    setUser({ id: 1, name: 'Test User' });
    renderHeader();

    expect(screen.getByAltText('Xmobile')).toBeTruthy();
    expect(screen.getByLabelText('notifications')).toBeTruthy();
  });

  it('links to the sale page only while something is on sale', () => {
    setUser(undefined);
    vi.mocked(useSaleAvailability).mockReturnValue(false);
    const { unmount } = renderHeader();
    expect(screen.queryByRole('link', { name: 'Sale' })).toBeNull();
    unmount();

    vi.mocked(useSaleAvailability).mockReturnValue(true);
    renderHeader();

    expect(
      screen.getByRole('link', { name: 'Sale' }).getAttribute('href'),
    ).toBe('/sale');
  });

  it('has the sale link in the web header too', () => {
    setUser(undefined);
    vi.mocked(usePlatform).mockReturnValue('web');
    vi.mocked(useSaleAvailability).mockReturnValue(true);
    renderHeader();

    expect(
      screen.getByRole('link', { name: 'Sale' }).getAttribute('href'),
    ).toBe('/sale');
  });

  it('Find pushes the term into the home URL immediately', async () => {
    setUser(undefined);
    renderHeader();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'iphone' },
    });
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Search' }));

    expect(mockRouter.query.searchKeyword).toBe('iphone');
  });
});
