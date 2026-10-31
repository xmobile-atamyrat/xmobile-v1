// @vitest-environment jsdom

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, Fragment, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock calls below are hoisted above these imports by vitest.
import ProductImageGallery from '@/pages/components/ProductImageGallery';
import ProductImageLightbox from '@/pages/components/ProductImageLightbox';
import { usePlatform } from '@/pages/lib/PlatformContext';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/PlatformContext', async () => {
  const actual = await vi.importActual<
    typeof import('@/pages/lib/PlatformContext')
  >('@/pages/lib/PlatformContext');
  return { ...actual, usePlatform: vi.fn() };
});

const previews = ['/p/a.webp', '/p/b.webp', '/p/c.webp', '/p/d.webp'];
const originals = ['/o/a.jpg', '/o/b.jpg', '/o/c.jpg', '/o/d.jpg'];

// Mirrors how [slug].page.tsx wires the two: one index, shared.
function Harness() {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  return createElement(
    Fragment,
    null,
    createElement(ProductImageGallery, {
      displayImgUrls: previews,
      altText: 'Phone',
      selectedIndex: index,
      onSelect: setIndex,
      onExpand: (i: number) => {
        setIndex(i);
        setOpen(true);
      },
    }),
    createElement(ProductImageLightbox, {
      open,
      onClose: () => setOpen(false),
      previewUrls: previews,
      fullUrls: originals,
      index,
      onIndexChange: setIndex,
      altText: 'Phone',
    }),
  );
}

function openViewer() {
  // The frame owns the click; the img itself takes no pointer events.
  const mainImg = screen.getAllByRole('img', { name: 'Phone' })[0];
  fireEvent.click(mainImg.parentElement as HTMLElement);
  return screen.getByRole('dialog');
}

// While the dialog is open MUI aria-hides the page behind it, hence hidden.
function galleryActiveThumb() {
  return screen
    .getAllByRole('button', { name: /^Go to image/, hidden: true })
    .filter((el) => !screen.getByRole('dialog').contains(el))
    .findIndex((el) => el.className.includes('border-navy'));
}

describe('ProductImageLightbox (web)', () => {
  beforeEach(() => {
    vi.mocked(usePlatform).mockReturnValue('web');
  });

  it('opens on the clicked image and closes from the close button', async () => {
    renderWithProviders(createElement(Harness));
    const dialog = openViewer();
    expect(within(dialog).getByText('1 / 4')).toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Close' }),
    );
    // MUI fades the dialog out before unmounting it
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('moves between images without closing and keeps the gallery in step', async () => {
    renderWithProviders(createElement(Harness));
    const dialog = openViewer();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(within(dialog).getByText('3 / 4')).toBeInTheDocument();
    expect(galleryActiveThumb()).toBe(2);

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Previous' }),
    );
    expect(within(dialog).getByText('2 / 4')).toBeInTheDocument();
    expect(galleryActiveThumb()).toBe(1);
  });

  it('wraps around and follows the arrow keys', () => {
    renderWithProviders(createElement(Harness));
    const dialog = openViewer();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(within(dialog).getByText('4 / 4')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(within(dialog).getByText('1 / 4')).toBeInTheDocument();
  });

  it('opens on the image the gallery is showing', async () => {
    renderWithProviders(createElement(Harness));
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Go to image 3' })[0],
    );
    const dialog = openViewer();
    expect(within(dialog).getByText('3 / 4')).toBeInTheDocument();
  });

  it('only requests originals for the current image and its neighbours', () => {
    renderWithProviders(createElement(Harness));
    const dialog = openViewer();
    const srcs = Array.from(dialog.querySelectorAll('img')).map((img) =>
      img.getAttribute('src'),
    );
    expect(srcs).toEqual(
      expect.arrayContaining(['/o/a.jpg', '/o/b.jpg', '/o/d.jpg']),
    );
    expect(srcs).not.toContain('/o/c.jpg');
  });

  it('never lets a product photo be the target of a press or right click', () => {
    renderWithProviders(createElement(Harness));
    const dialog = openViewer();
    const imgs = [
      ...screen.getAllByRole('img', { hidden: true }),
      ...Array.from(dialog.querySelectorAll('img')),
    ];
    expect(imgs.length).toBeGreaterThan(0);
    imgs.forEach((img) => {
      expect(img.className).toContain('pointer-events-none');
      expect(img.getAttribute('draggable')).toBe('false');
    });

    const menu = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    });
    dialog.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
  });
});

describe('ProductImageLightbox (mobile)', () => {
  beforeEach(() => {
    vi.mocked(usePlatform).mockReturnValue('mobile');
  });

  it('swipes between images inside the viewer', () => {
    renderWithProviders(createElement(Harness));
    const dialog = openViewer();
    const track = dialog.querySelector('.touch-none') as HTMLElement;

    fireEvent.touchStart(track, { touches: [{ clientX: 300 }] });
    fireEvent.touchMove(track, { touches: [{ clientX: 150 }] });
    fireEvent.touchEnd(track, { changedTouches: [{ clientX: 150 }] });
    expect(within(dialog).getByText('2 / 4')).toBeInTheDocument();

    fireEvent.touchStart(track, { touches: [{ clientX: 100 }] });
    fireEvent.touchMove(track, { touches: [{ clientX: 120 }] });
    fireEvent.touchEnd(track, { changedTouches: [{ clientX: 120 }] });
    expect(within(dialog).getByText('2 / 4')).toBeInTheDocument();
  });

  it('has a close button and no desktop arrows', () => {
    renderWithProviders(createElement(Harness));
    const dialog = openViewer();
    expect(
      within(dialog).getByRole('button', { name: 'Close' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Next' }),
    ).not.toBeInTheDocument();
  });
});
