// Procurement → Products tab (components/ProductsPanel.tsx + products/*).
// Built on the shared tokens in ./index.ts. Mobile is a white card list (one
// row per product: name · quantity · remove); desktop is the same rows laid
// out as a roomy table inside `procurementClasses.cardWeb`.
import { procurementClasses } from '@/styles/classMaps/procurement';

// name column grows; index / quantity / remove are fixed so names wrap instead
// of pushing the row wider.
const webGrid =
  'grid grid-cols-[32px_minmax(0,1fr)_140px_40px] items-center gap-4 px-5';

export const productsPanelClasses = {
  root: 'flex flex-col gap-3 min-w-0',

  // --- header: "12 товаров" + Add products ---
  head: 'flex items-center justify-between gap-3 min-w-0',
  count: {
    mobile: 'text-[16px] font-bold text-ink ml-1',
    web: 'text-[18px] font-bold text-ink',
  },
  addBtn: `${procurementClasses.btnSoft} flex-none`,

  // --- amber hint shown while some rows have no quantity ---
  hint: 'flex items-start gap-2 rounded-[12px] bg-[#FFF6E5] px-3 py-[10px] text-[13px] leading-[1.45] text-[#8A5A00]',
  hintIcon: 'w-4 h-4 flex-none mt-[2px]',

  // --- list ---
  list: {
    mobile: procurementClasses.card,
    web: procurementClasses.cardWeb,
  },
  tableHead: `${webGrid} h-11 border-b border-hairline bg-[#FAFAFC] text-[12px] font-bold uppercase tracking-[0.06em] text-muted`,
  tableHeadQty: 'text-center',
  row: {
    mobile: 'flex items-center gap-3 px-4 py-3 min-h-[68px]',
    web: `${webGrid} py-3 min-h-[68px]`,
  },
  rowBorder: 'border-b border-fill',
  // Rows with an empty / zero quantity are left out of the supplier files.
  rowZero: 'bg-[#FFFBF2]',
  index: 'text-[13px] text-muted',
  nameCol: 'flex-1 min-w-0 flex flex-col gap-[3px]',
  name: 'text-[15px] font-medium text-ink leading-[1.35] break-words',
  meta: 'text-[12px] leading-4 flex items-center gap-1 text-muted',
  metaZero: 'text-[#B26B00]',
  metaSaved: 'text-[#1F9A5A]',
  metaIcon: 'w-3 h-3 flex-none',
  metaSpin: 'w-3 h-3 flex-none animate-spin',
  qty: {
    mobile: 'w-[88px] flex-none',
    web: 'w-full',
  },
  removeBtn: `${procurementClasses.iconBtnGhost} transition-colors hover:bg-[#FDECEE] hover:text-red active:bg-[#FDECEE] active:text-red`,

  // --- search (shown for > 8 products) ---
  searchIcon: 'w-[18px] h-[18px] text-muted',
  noMatch: 'px-4 py-8 text-center text-[14px] text-muted',

  // --- empty state ---
  empty: procurementClasses.empty,
  emptyIcon: procurementClasses.emptyIcon,
  emptyText: 'text-[14px] text-muted mb-2',
  emptyBtn: procurementClasses.btnPrimary,

  skeletonRow: 'flex items-center gap-3 px-4 py-4',
};

/** Amber outline for quantity fields that are empty or 0. */
export const zeroQuantityFieldSx = {
  '& .MuiOutlinedInput-root fieldset': { borderColor: '#F2C46D' },
};
