import { useLayoutEffect, useRef, useState } from 'react';

interface EditableTextProps {
  value: string | number | null | undefined;
  onTextChange: (text: string | null) => void;
}

/**
 * An inline-editable text cell body.
 *
 * The browser edits the DOM text inside a contentEditable element on its own,
 * and it removes the text node entirely when the last character is deleted.
 * If React also owned that text node, its next render would call removeChild
 * on a node that is already gone and the whole page would crash. So React
 * renders the inner span with no children at all, and the text is written
 * here by hand, only when it really differs from what is on screen.
 *
 * The outer div exists only for looks: it stretches to the full height of the
 * table cell (the cell sets height: 1px so a percentage height resolves),
 * centres the text vertically like the neighbouring cells, and draws the focus
 * ring around the whole cell instead of a thin line around the text.
 */
export default function EditableText({
  value,
  onTextChange,
}: EditableTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [focused, setFocused] = useState(false);
  const text = value == null ? '' : String(value);

  useLayoutEffect(() => {
    const box = ref.current;
    if (box == null || box.textContent === text) return;
    // Never overwrite a box the admin is typing in. The table can re-derive
    // mid-edit (a save, a categories refresh) before the typed value has
    // reached the parent, and writing then would undo the typing and throw
    // the caret to the start.
    if (document.activeElement === box) return;
    box.textContent = text;
  }, [text]);

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      // A press on the padding (top or bottom of the cell) lands on this div,
      // not on the text, and a plain focus() would leave the caret at the
      // start. Send it to the end instead, which is where an admin who is
      // about to delete or extend the value wants it. Presses on the text
      // itself are left to the browser so a mid-word click still works.
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget || ref.current == null) return;
        e.preventDefault();
        const box = ref.current;
        box.focus();
        const range = document.createRange();
        range.selectNodeContents(box);
        range.collapse(false);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }}
      style={{
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        padding: 16,
        cursor: 'text',
        outline: focused ? '-webkit-focus-ring-color auto 1px' : 'none',
      }}
    >
      <span
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onTextChange(e.currentTarget.textContent)}
        onFocus={() => setFocused(true)}
        // Only an emptied box snaps back to the last real value when the
        // admin leaves it, so nothing blank is left on screen. A non-empty
        // edit is kept as typed: the parent's copy of it lags behind by a
        // short delay, so restoring here would wrongly undo it.
        onBlur={(e) => {
          setFocused(false);
          if ((e.currentTarget.textContent ?? '').trim() === '') {
            e.currentTarget.textContent = text;
          }
        }}
        style={{
          flex: 1,
          minWidth: 40,
          minHeight: '1.5em',
          outline: 'none',
        }}
      />
    </div>
  );
}
