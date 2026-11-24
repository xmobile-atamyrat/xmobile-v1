// @vitest-environment jsdom

import EditableText from '@/pages/product/components/EditableText';
import { fireEvent, render } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

const renderCell = (value: string | number | null, onTextChange = vi.fn()) =>
  render(createElement(EditableText, { value, onTextChange }));

const getBox = () => {
  const box = document.querySelector<HTMLElement>('[contenteditable]');
  if (box == null) throw new Error('editable box not found');
  return box;
};

describe('EditableText', () => {
  it('shows the given value', () => {
    renderCell('Flash Drive');

    expect(getBox().textContent).toBe('Flash Drive');
  });

  it('reports what the admin types', () => {
    const onTextChange = vi.fn();
    renderCell('Flash Drive', onTextChange);

    getBox().textContent = 'Flash Drive 2';
    fireEvent.input(getBox());

    expect(onTextChange).toHaveBeenCalledWith('Flash Drive 2');
  });

  // Regression: deleting the last character makes the browser drop the text
  // node. When React owned that node, the next render threw removeChild and
  // crashed the whole page.
  it('survives the browser removing its text node and a re-render', () => {
    const { rerender } = renderCell('Flash Drive');

    const box = getBox();
    while (box.firstChild) box.removeChild(box.firstChild);

    expect(() =>
      rerender(
        createElement(EditableText, {
          value: null,
          onTextChange: vi.fn(),
        }),
      ),
    ).not.toThrow();
    expect(getBox().textContent).toBe('');
  });

  it('puts the last value back when left empty', () => {
    renderCell('Flash Drive');

    getBox().textContent = '';
    fireEvent.blur(getBox());

    expect(getBox().textContent).toBe('Flash Drive');
  });

  // Regression: the parent's copy of the value lags behind typing, so leaving
  // a non-empty box must not revert it (this broke editing several rows).
  it('keeps typed text when left, even if the value prop is stale', () => {
    renderCell('Flash Drive');

    getBox().textContent = 'Renamed';
    fireEvent.blur(getBox());

    expect(getBox().textContent).toBe('Renamed');
  });
});
