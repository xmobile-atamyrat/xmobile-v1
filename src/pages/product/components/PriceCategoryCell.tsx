import { FormControl, MenuItem, Select, Typography } from '@mui/material';
import { memo, useState } from 'react';
import { CategoryOption, categoryMenuItems } from './categoryOptions';

interface PriceCategoryCellProps {
  priceId: string;
  value: string | null;
  options: CategoryOption[];
  // Takes the price id so the page can hand down one stable callback for every
  // row, which is what keeps the memo below effective.
  onChange: (priceId: string, categoryId: string | null) => void;
  emptyLabel: string;
  dirty?: boolean;
}

// The price table renders every row at once (no pagination or virtualization),
// so keeping a live Select in each row would make first paint heavier at a few
// hundred prices. The cell shows plain text until clicked and only then mounts
// the dropdown — already open, so it still costs a single click.
function PriceCategoryCell({
  priceId,
  value,
  options,
  onChange,
  emptyLabel,
  dirty = false,
}: PriceCategoryCellProps) {
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
          onChange(priceId, e.target.value === '' ? null : e.target.value)
        }
      >
        <MenuItem value="">{emptyLabel}</MenuItem>
        {categoryMenuItems(options)}
      </Select>
    </FormControl>
  );
}

export default memo(PriceCategoryCell);
