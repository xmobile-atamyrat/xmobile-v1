// @vitest-environment jsdom

import EditableText from '@/pages/product/components/EditableText';
import { fireEvent, render } from '@testing-library/react';
import { createElement, useRef, useState } from 'react';
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

  // Regression: Grammarly injected an element beside the box, which the table
  // laid out as an extra cell, shifting the row and narrowing every column.
  it('opts out of Grammarly', () => {
    renderCell('Flash Drive');

    const box = getBox();
    expect(box.getAttribute('data-gramm')).toBe('false');
    expect(box.getAttribute('data-gramm_editor')).toBe('false');
    expect(box.getAttribute('data-enable-grammarly')).toBe('false');
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

  it('puts the caret at the end when the cell padding is pressed', () => {
    renderCell('Flash Drive');

    // The outer wrapper is the padded cell area around the text.
    const padding = getBox().parentElement as HTMLElement;
    fireEvent.mouseDown(padding);

    const selection = window.getSelection();
    expect(selection?.isCollapsed).toBe(true);
    // "End of the text" is recorded as: inside the box, after its last child.
    expect(selection?.anchorNode).toBe(getBox());
    expect(selection?.anchorOffset).toBe(getBox().childNodes.length);
    expect(document.activeElement).toBe(getBox());
  });

  it('does not overwrite the box while the admin is typing in it', () => {
    const { rerender } = renderCell('Flash Drive');

    const box = getBox();
    box.focus();
    box.textContent = 'Flash Dr';
    rerender(
      createElement(EditableText, {
        value: 'Another product',
        onTextChange: vi.fn(),
      }),
    );

    expect(box.textContent).toBe('Flash Dr');
  });

  it('shows a new value when the box is not being edited', () => {
    const { rerender } = renderCell('Flash Drive');

    rerender(
      createElement(EditableText, {
        value: 'Flash Drive 2',
        onTextChange: vi.fn(),
      }),
    );

    expect(getBox().textContent).toBe('Flash Drive 2');
  });

  it('puts the last value back when left empty', () => {
    renderCell('Flash Drive');

    getBox().textContent = '';
    fireEvent.blur(getBox());

    expect(getBox().textContent).toBe('Flash Drive');
  });

  // A parent like the update-prices page: typing is only recorded once
  // onCommit runs, and only if `accept` says the text is valid.
  const renderWithParent = (accept: (text: string) => boolean) => {
    function Parent() {
      const [value, setValue] = useState('Flash Drive');
      const typed = useRef<string | null>(null);
      return createElement(EditableText, {
        value,
        onTextChange: (text) => {
          typed.current = text;
        },
        onCommit: () => {
          if (typed.current != null && accept(typed.current)) {
            setValue(typed.current);
          }
        },
      });
    }
    render(createElement(Parent));
  };

  // Regression: leaving the box must not undo an edit the parent has only
  // just recorded (this broke editing several rows).
  it('keeps an accepted edit when left', () => {
    renderWithParent(() => true);

    getBox().textContent = 'Renamed';
    fireEvent.input(getBox());
    fireEvent.blur(getBox());

    expect(getBox().textContent).toBe('Renamed');
  });

  it('goes back to the real value when the edit is rejected', () => {
    renderWithParent((text) => !Number.isNaN(parseFloat(text)));

    getBox().textContent = 'abc';
    fireEvent.input(getBox());
    fireEvent.blur(getBox());

    expect(getBox().textContent).toBe('Flash Drive');
  });
});
