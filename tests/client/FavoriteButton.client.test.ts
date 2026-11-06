// @vitest-environment jsdom

import FavoriteButton from '@/pages/components/FavoriteButton';
import { useFavoritesContext } from '@/pages/lib/FavoritesContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { fireEvent, screen } from '@testing-library/react';
import mockRouter from 'next-router-mock';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/UserContext', () => ({
  useUserContext: vi.fn(),
}));

vi.mock('@/pages/lib/FavoritesContext', () => ({
  useFavoritesContext: vi.fn(),
}));

const toggleFavorite = vi.fn();

function renderButton({
  user = { id: 'u1' },
  isLoading = false,
  favorite = false,
}: {
  user?: { id: string } | null;
  isLoading?: boolean;
  favorite?: boolean;
} = {}) {
  vi.mocked(useUserContext).mockReturnValue({
    user: user ?? undefined,
    isLoading,
  } as never);
  vi.mocked(useFavoritesContext).mockReturnValue({
    isFavorite: () => favorite,
    toggleFavorite,
    addFavorites: vi.fn(),
  });
  return renderWithProviders(
    createElement(FavoriteButton, { productId: 'p1', variant: 'card' }),
  );
}

describe('FavoriteButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouter.setCurrentUrl('/product');
  });

  it('offers to add a product that is not a favorite', () => {
    renderButton();

    const button = screen.getByRole('button', { name: 'Add to favorites' });

    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('offers to remove a favorite', () => {
    renderButton({ favorite: true });

    const button = screen.getByRole('button', {
      name: 'Remove from favorites',
    });

    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles the product for a signed-in user', () => {
    renderButton();

    fireEvent.click(screen.getByRole('button'));

    expect(toggleFavorite).toHaveBeenCalledWith('p1');
    expect(mockRouter.asPath).toBe('/product');
  });

  it('sends a guest to sign in', () => {
    renderButton({ user: null });

    fireEvent.click(screen.getByRole('button'));

    expect(mockRouter.asPath).toBe('/user/signin');
    expect(toggleFavorite).not.toHaveBeenCalled();
  });

  it('does nothing until the session has loaded', () => {
    renderButton({ user: null, isLoading: true });

    fireEvent.click(screen.getByRole('button'));

    expect(mockRouter.asPath).toBe('/product');
    expect(toggleFavorite).not.toHaveBeenCalled();
  });
});
