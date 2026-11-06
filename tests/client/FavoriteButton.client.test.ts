// @vitest-environment jsdom

import FavoriteButton from '@/pages/components/FavoriteButton';
import { useFavoritesContext } from '@/pages/lib/FavoritesContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { fireEvent, screen } from '@testing-library/react';
import mockRouter from 'next-router-mock';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { endAnimation } from './helpers/endAnimation';
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

  describe('animation', () => {
    const heart = () => screen.getByRole('button').querySelector('svg');

    // Flips like the real context, which changes the set before it saves.
    function renderToggling(initial: boolean) {
      let favorite = initial;
      toggleFavorite.mockImplementation(() => {
        favorite = !favorite;
      });
      vi.mocked(useUserContext).mockReturnValue({
        user: { id: 'u1' },
        isLoading: false,
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

    it('pops the heart when a product is added', () => {
      renderToggling(false);

      fireEvent.click(screen.getByRole('button'));

      expect(heart()?.getAttribute('class')).toContain('animate-favorite-pop');
    });

    it('shrinks the heart when a product is removed', () => {
      renderToggling(true);

      fireEvent.click(screen.getByRole('button'));

      expect(heart()?.getAttribute('class')).toContain(
        'animate-favorite-shrink',
      );
    });

    it('stays still when a heart is already filled on load', () => {
      renderButton({ favorite: true });

      expect(heart()?.getAttribute('class')).not.toContain('animate-');
    });

    it('stays still when a guest is sent to sign in', () => {
      renderButton({ user: null });

      fireEvent.click(screen.getByRole('button'));

      expect(heart()?.getAttribute('class')).not.toContain('animate-');
    });

    it('clears the animation so the next tap can play it again', () => {
      renderToggling(false);
      fireEvent.click(screen.getByRole('button'));

      endAnimation(heart() as Element);

      expect(heart()?.getAttribute('class')).not.toContain('animate-');
    });
  });

  describe('onRemove', () => {
    const renderWithOnRemove = (favorite: boolean, onRemove: () => void) => {
      vi.mocked(useUserContext).mockReturnValue({
        user: { id: 'u1' },
        isLoading: false,
      } as never);
      vi.mocked(useFavoritesContext).mockReturnValue({
        isFavorite: () => favorite,
        toggleFavorite,
        addFavorites: vi.fn(),
      });
      return renderWithProviders(
        createElement(FavoriteButton, {
          productId: 'p1',
          variant: 'card',
          onRemove,
        }),
      );
    };

    it('reports a removal', () => {
      const onRemove = vi.fn();
      renderWithOnRemove(true, onRemove);

      fireEvent.click(screen.getByRole('button'));

      expect(onRemove).toHaveBeenCalledOnce();
    });

    it('does not report an addition', () => {
      const onRemove = vi.fn();
      renderWithOnRemove(false, onRemove);

      fireEvent.click(screen.getByRole('button'));

      expect(onRemove).not.toHaveBeenCalled();
    });
  });
});
