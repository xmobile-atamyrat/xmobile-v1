import {
  FormControl,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { memo, useRef, useState } from 'react';

export interface SelectCellOption {
  id: string;
  name: string;
  // Indentation level for tree-shaped option lists (categories). Flat lists
  // like brands leave it out and render flush.
  depth?: number;
}

interface SelectCellProps {
  id: string;
  value: string | null;
  options: SelectCellOption[];
  // Takes the row's own id so the page can hand down one stable callback for
  // every row, which is what keeps the memo below effective.
  onChange: (id: string, optionId: string | null) => void;
  emptyLabel: string;
  dirty?: boolean;
  // Prices can be uncategorized; products can't (the API rejects a missing
  // category), so the product table hides this option rather than let an
  // admin pick a state the save will just reject.
  allowEmpty?: boolean;
  // Opt-in inline creation. Resolves to the new option's id, or null when the
  // name was blank or the create failed — the caller owns error reporting.
  // Omitted by the category columns, whose tree is not something to extend
  // from a table row.
  onCreate?: (name: string) => Promise<string | null>;
  createLabel?: string;
  createPlaceholder?: string;
}

// Sentinel for the "create a new one" row. Real ids are uuids, so this cannot
// collide with an option.
const CREATE_OPTION = '__create__';

// The prices and products tables both render every row at once (no pagination
// or virtualization), so keeping a live Select in each row would make first
// paint heavier at a few hundred rows. The cell shows plain text until clicked
// and only then mounts the dropdown — already open, so it still costs a single
// click.
function SelectCell({
  id,
  value,
  options,
  onChange,
  emptyLabel,
  dirty = false,
  allowEmpty = true,
  onCreate,
  createLabel,
  createPlaceholder,
}: SelectCellProps) {
  const [mode, setMode] = useState<'idle' | 'select' | 'create'>('idle');
  const [draftName, setDraftName] = useState('');
  // Enter and blur can both reach submitDraft for one typed name, and the
  // create is a network round-trip, so a second entrant would create the brand
  // twice. Latched for the lifetime of one draft and released when the next
  // one opens.
  const settled = useRef(false);
  const name = options.find((option) => option.id === value)?.name;

  const openCreate = () => {
    settled.current = false;
    setDraftName('');
    setMode('create');
  };

  const closeCreate = () => {
    settled.current = true;
    setDraftName('');
    setMode('idle');
  };

  const submitDraft = async () => {
    if (settled.current || onCreate == null) return;
    settled.current = true;
    try {
      const createdId = await onCreate(draftName);
      if (createdId != null) onChange(id, createdId);
    } finally {
      setDraftName('');
      setMode('idle');
    }
  };

  if (mode === 'create') {
    return (
      <TextField
        autoFocus
        size="small"
        sx={{ minWidth: 200 }}
        placeholder={createPlaceholder}
        value={draftName}
        onChange={(e) => setDraftName(e.target.value)}
        onBlur={submitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submitDraft();
          } else if (e.key === 'Escape') {
            // Latches `settled` too, so the blur that follows this unmount
            // cannot resurrect the name the admin just abandoned.
            closeCreate();
          }
        }}
      />
    );
  }

  if (mode === 'idle') {
    return (
      <Typography
        onClick={() => setMode('select')}
        sx={{
          cursor: 'pointer',
          // Matches the dropdown's width so the column does not jump on click.
          minWidth: 200,
          color: name == null ? 'text.disabled' : 'text.primary',
          fontWeight: dirty ? 600 : 400,
          '&:hover': { textDecoration: 'underline' },
        }}
      >
        {name ?? emptyLabel}
      </Typography>
    );
  }

  return (
    <FormControl size="small" sx={{ minWidth: 200 }}>
      <Select
        defaultOpen
        value={value ?? ''}
        // Closing must not stomp the create field the pick just opened.
        onClose={() => setMode((prev) => (prev === 'select' ? 'idle' : prev))}
        onChange={(e) => {
          if (e.target.value === CREATE_OPTION) {
            openCreate();
            return;
          }
          onChange(id, e.target.value === '' ? null : e.target.value);
        }}
      >
        {allowEmpty && <MenuItem value="">{emptyLabel}</MenuItem>}
        {options.map((option) => (
          <MenuItem
            key={option.id}
            value={option.id}
            sx={{ pl: 2 + (option.depth ?? 0) * 1.5 }}
          >
            {option.name}
          </MenuItem>
        ))}
        {onCreate != null && (
          <MenuItem value={CREATE_OPTION}>+ {createLabel}</MenuItem>
        )}
      </Select>
    </FormControl>
  );
}

export default memo(SelectCell);
