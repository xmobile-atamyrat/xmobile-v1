// @vitest-environment jsdom

import HomeBrandChips from '@/pages/components/HomeBrandChips';
import { act, fireEvent, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

const brands = [
  { id: 'b1', name: 'Samsung' },
  { id: 'b2', name: 'Apple' },
];

const renderChips = (selectedId: string | null, onSelect = vi.fn()) => {
  renderWithProviders(
    createElement(HomeBrandChips, { brands, selectedId, onSelect }),
    { locale: 'en' },
  );
  return onSelect;
};

describe('HomeBrandChips', () => {
  it('selects the tapped brand', () => {
    const onSelect = renderChips(null);

    fireEvent.click(screen.getByRole('button', { name: 'Samsung' }));

    expect(onSelect).toHaveBeenCalledWith('b1');
    expect(screen.getByText('Choose a brand')).toBeInTheDocument();
  });

  it('marks the selected brand and deselects it on a second tap', () => {
    const onSelect = renderChips('b1');

    const chip = screen.getByRole('button', { name: 'Samsung' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Apple' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    fireEvent.click(chip);

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('renders nothing without brands', () => {
    const { container } = renderWithProviders(
      createElement(HomeBrandChips, {
        brands: [],
        selectedId: null,
        onSelect: vi.fn(),
      }),
      { locale: 'en' },
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe('HomeBrandChips carousel', () => {
  let frames: FrameRequestCallback[] = [];
  let now = 0;
  // Runs queued frames `ms` apart, as the browser would.
  const advance = (count: number, ms = 100) => {
    for (let i = 0; i < count; i += 1) {
      now += ms;
      const at = now;
      const queued = frames;
      frames = [];
      act(() => queued.forEach((cb) => cb(at)));
    }
  };
  const row = () =>
    screen.getAllByRole('button', { name: 'Samsung' })[0].parentElement!
      .parentElement!;

  beforeEach(() => {
    frames = [];
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
      frames = [];
    });
    // One copy of chips is 500px wide in a 300px row, so it overflows.
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(500);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('repeats the chips for the loop, out of reach of assistive tech', () => {
    renderChips(null);

    expect(screen.getAllByRole('button')).toHaveLength(2);
    const copies = document.querySelectorAll('button');
    expect(copies).toHaveLength(4);
    expect(copies[2]).toHaveAttribute('tabindex', '-1');
    expect(copies[2].parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('drifts until a brand is picked, wrapping after one copy', () => {
    renderChips(null);
    advance(11);
    // 30px/s over 1s, after the first frame only sets the clock.
    expect(row().scrollLeft).toBeCloseTo(30);

    // Drifting past one copy (500px) lands back on the identical spot.
    fireEvent.touchStart(row());
    row().scrollLeft = 499;
    advance(1);
    fireEvent.touchEnd(row());
    advance(31);
    expect(row().scrollLeft).toBeGreaterThan(0);
    expect(row().scrollLeft).toBeLessThan(10);
  });

  it('wraps scrolling by the user both ways', () => {
    renderChips(null);
    row().scrollLeft = 515;
    fireEvent.scroll(row());
    expect(row().scrollLeft).toBe(15);

    // Backwards past the start only while the user is scrolling.
    fireEvent.touchStart(row());
    row().scrollLeft = -1;
    fireEvent.scroll(row());
    expect(row().scrollLeft).toBe(499);
  });

  it('stays still while a brand is picked', () => {
    renderChips('b1');
    const before = row().scrollLeft;
    advance(20);

    expect(row().scrollLeft).toBe(before);
    expect(frames).toHaveLength(0);
  });

  it('lets the user take over, then resumes', () => {
    renderChips(null);
    advance(1);
    fireEvent.touchStart(row());
    row().scrollLeft = 200;
    advance(50);
    expect(row().scrollLeft).toBe(200);

    fireEvent.touchEnd(row());
    advance(29);
    expect(row().scrollLeft).toBe(200);
    advance(11);
    expect(row().scrollLeft).toBeGreaterThan(200);
  });

  it('does not loop when the chips fit', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(200);
    renderChips(null);

    expect(document.querySelectorAll('button')).toHaveLength(2);
    advance(10);
    expect(row().scrollLeft).toBe(0);
  });
});
