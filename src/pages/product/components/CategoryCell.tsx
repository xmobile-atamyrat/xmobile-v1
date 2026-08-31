import { FormControl, MenuItem, Select, Typography } from '@mui/material';
import { memo, useState } from 'react';
import { CategoryOption, categoryMenuItems } from './categoryOptions';

interface CategoryCellProps {
  id: string;
  value: string | null;
  options: CategoryOption[];
  // Takes the row's own id so the page can hand down one stable callback for
  // every row, which is what keeps the memo below effective.
  onChange: (id: string, categoryId: string | null) => void;
  emptyLabel: string;
  dirty?: boolean;
  // Prices can be uncategorized; products can't (the API rejects a missing
  // category), so the product table hides this option rather than let an
  // admin pick a state the save will just reject.
  allowEmpty?: boolean;
}

// The prices and products tables both render every row at once (no pagination
// or virtualization), so keeping a live Select in each row would make first
// paint heavier at a few hundred rows. The cell shows plain text until clicked
// and only then mounts the dropdown — already open, so it still costs a single
// click.
function CategoryCell({
  id,
  value,
  options,
  onChange,
  emptyLabel,
  dirty = false,
  allowEmpty = true,
}: CategoryCellProps) {
  const [editing, setEditing] = useState(false);
  const name = options.find((option) => option.id === value)?.name;

  if (!editing) {
    return (
      <Typography
        onClick={() => setEditing(true)}
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
        onClose={() => setEditing(false)}
        onChange={(e) =>
          onChange(id, e.target.value === '' ? null : e.target.value)
        }
      >
        {allowEmpty && <MenuItem value="">{emptyLabel}</MenuItem>}
        {categoryMenuItems(options)}
      </Select>
    </FormControl>
  );
}

export default memo(CategoryCell);
