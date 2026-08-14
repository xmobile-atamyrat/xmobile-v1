import { ExtendedCategory } from '@/pages/lib/types';
import { parseName } from '@/pages/lib/utils';
import { MenuItem } from '@mui/material';

export interface CategoryOption {
  id: string;
  name: string;
  depth: number;
}

// Depth-first flattening of the nested category tree. Sibling order is
// preserved so the flat list reads like the tree it came from, and `depth`
// drives the indentation that makes the subtree structure visible.
export const flattenCategories = (
  categories: ExtendedCategory[],
  locale: string,
): CategoryOption[] => {
  const flat: CategoryOption[] = [];
  const walk = (nodes: ExtendedCategory[], depth: number) => {
    nodes.forEach((node) => {
      flat.push({ id: node.id, name: parseName(node.name, locale), depth });
      if (node.successorCategories) walk(node.successorCategories, depth + 1);
    });
  };
  walk(categories, 0);
  return flat;
};

// Indented menu items shared by the update-prices filter, its per-row category
// dropdowns, and the AddPrice dialog, so all three render the tree identically.
export const categoryMenuItems = (options: CategoryOption[]) =>
  options.map((option) => (
    <MenuItem
      key={option.id}
      value={option.id}
      sx={{ pl: 2 + option.depth * 1.5 }}
    >
      {option.name}
    </MenuItem>
  ));
