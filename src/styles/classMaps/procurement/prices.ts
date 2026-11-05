// Procurement → Prices tab (components/PricesPanel.tsx + components/prices/*).
// Mobile: one white card per product, one row per supplier. Desktop: the
// products x suppliers matrix inside a card that scrolls on its own, with a
// sticky header row and a sticky product column.
//
// Marks: green = "buy here" (light green tint + check, not the old saturated
// box), orange = flagged (light amber tint), white = no mark.
import type { OrderPriceColor } from '@prisma/client';

export const priceMarkClasses: Record<
  OrderPriceColor,
  {
    /** Row / cell background. */
    tint: string;
    /** The round swatch in the mark button and the picker. */
    dot: string;
    /** Small label under the supplier name ("Buy here" / "Flagged"). */
    label: string;
    /** Input border when the cell carries the mark. */
    field: string;
  }
> = {
  white: {
    tint: '',
    dot: 'bg-white !border-[1.5px] !border-solid !border-[#C9C8D3]',
    label: 'text-muted',
    field: 'border-hairline',
  },
  orange: {
    tint: 'bg-[#FFF6E8]',
    dot: 'bg-[#F59E0B]',
    label: 'text-[#B45309]',
    field: 'border-[#F5C77E]',
  },
  green: {
    tint: 'bg-[#EAF7EF]',
    dot: 'bg-[#16A34A] text-white',
    label: 'text-[#15803D]',
    field: 'border-[#86CFA0]',
  },
};

export const pricesClasses = {
  // --- summary + filter chips ---
  summary: 'bg-white rounded-[16px] p-4 flex flex-col gap-3',
  summaryWeb:
    'bg-white border border-hairline rounded-[18px] px-5 py-4 flex flex-wrap items-center gap-x-8 gap-y-3',
  summaryStats: 'flex flex-wrap items-end gap-x-6 gap-y-2',
  statValue:
    'text-[20px] font-bold text-ink leading-tight [font-variant-numeric:tabular-nums]',
  statValueGreen:
    'text-[20px] font-bold text-[#15803D] leading-tight [font-variant-numeric:tabular-nums]',
  statLabel: 'text-[12px] text-muted mt-[2px]',
  progressTrack: 'h-[6px] w-full rounded-full bg-fill overflow-hidden',
  progressFill: 'h-full rounded-full bg-navy transition-[width]',
  hint: 'text-[13px] text-muted',
  chips:
    'flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
  // 36px chips, quieter than the main pill tabs so the hierarchy reads.
  chip: 'h-9 px-[14px] rounded-full text-[13px] font-semibold normal-case whitespace-nowrap flex items-center gap-[6px] flex-none !border !border-solid',
  chipIdle: 'bg-white text-[#4A4959] !border-hairline',
  chipActive: 'bg-[#EDEBF7] text-navy !border-navy',
  chipCount: 'text-[11px] font-bold opacity-70',

  // --- mobile cards ---
  list: 'flex flex-col gap-3',
  card: 'bg-white rounded-[16px] overflow-hidden',
  cardHead: 'flex items-start gap-3 px-4 pt-[14px] pb-[10px]',
  cardTitle:
    'flex-1 min-w-0 text-[15px] font-semibold text-ink break-words leading-snug',
  cardMeta: 'text-[12px] text-muted mt-[2px]',
  cardDimmed: 'bg-white/70 rounded-[16px] overflow-hidden',
  collapsedBtn:
    'w-full flex items-center gap-3 px-4 min-h-[56px] py-[10px] text-left normal-case justify-start',
  collapsedTitle:
    'flex-1 min-w-0 text-[15px] font-medium text-muted break-words leading-snug',
  notOrdered: 'text-[12px] text-muted mt-[2px]',
  row: 'flex items-center gap-2 pl-4 pr-1 min-h-[60px] py-2 border-t border-fill',
  rowSupplier: 'flex-1 min-w-0',
  rowName: 'text-[14px] text-ink break-words leading-snug line-clamp-2',
  rowNameChosen: 'font-semibold',
  rowMark: 'text-[11px] font-semibold mt-[2px] flex items-center gap-1',

  // --- price field (shared) ---
  field: {
    // 132px fits an 8-character price ("21450.50") plus the currency at
    // Android's common 1.1 font scale; 110px clipped "1099.75" on a Galaxy S22.
    mobile:
      'w-[132px] flex-none h-11 rounded-[12px] border-[1.5px] border-solid bg-white flex items-center pl-3 pr-2 gap-1 focus-within:!border-navy',
    web: 'w-[110px] flex-none h-9 rounded-[10px] border-[1.5px] border-solid bg-white flex items-center pl-[10px] pr-2 gap-1 focus-within:!border-navy',
  },
  fieldInput:
    'w-full min-w-0 bg-transparent outline-none text-[15px] text-ink [font-variant-numeric:tabular-nums] placeholder:text-[#C2C1CC]',
  fieldInputWeb:
    'w-full min-w-0 bg-transparent outline-none text-[14px] text-ink [font-variant-numeric:tabular-nums] placeholder:text-[#C2C1CC]',
  fieldSuffix: 'text-[11px] font-semibold text-muted flex-none',

  // --- mark button (≥40px target on mobile) ---
  markBtn: {
    mobile:
      'w-10 h-10 rounded-full flex items-center justify-center flex-none disabled:opacity-40',
    web: 'w-8 h-8 rounded-full flex items-center justify-center flex-none hover:bg-fill disabled:opacity-40',
  },
  markDot: 'w-5 h-5 rounded-full flex items-center justify-center flex-none',

  // --- mark picker (sheet on mobile, menu on web) ---
  pickerList: 'flex flex-col gap-2 pb-2',
  pickerOption:
    'w-full flex items-center gap-3 px-3 min-h-[60px] py-2 rounded-[14px] text-left normal-case justify-start !border-[1.5px] !border-solid',
  pickerOptionIdle: '!border-hairline bg-white',
  pickerOptionActive: '!border-navy bg-[#F7F6FC]',
  pickerDot: 'w-6 h-6 rounded-full flex items-center justify-center flex-none',
  pickerLabel: 'text-[15px] font-semibold text-ink leading-tight',
  pickerHint: 'text-[12px] text-muted mt-[2px] leading-snug',
  menuPaper: 'rounded-[14px] p-[6px] w-[300px]',

  // --- desktop table ---
  tableCaption:
    'flex items-center justify-between gap-3 px-5 py-3 border-b border-hairline',
  tableScroll: 'overflow-auto max-h-[70vh] overscroll-contain',
  table: 'border-separate border-spacing-0 min-w-full',
  th: 'sticky top-0 z-10 bg-[#FAFAFC] border-b border-hairline px-3 py-[10px] text-left align-bottom',
  thCorner:
    'sticky top-0 left-0 z-30 bg-[#FAFAFC] border-b border-r border-hairline px-4 py-[10px] text-left align-bottom',
  thText:
    'text-[12px] font-semibold text-[#4A4959] break-words line-clamp-2 min-w-[136px] max-w-[180px]',
  tdProduct:
    'sticky left-0 z-20 bg-white border-b border-r border-hairline px-4 py-2 text-left font-normal align-middle min-w-[220px] max-w-[300px]',
  tdProductName: 'text-[14px] font-medium text-ink break-words leading-snug',
  tdProductMeta: 'text-[12px] text-muted mt-[2px]',
  td: 'border-b border-fill px-2 py-[6px] align-middle',
  tdInner: 'flex items-center gap-1',
  rowDimmed: 'opacity-55',

  // --- empty ---
  emptyCard: 'bg-white rounded-[16px]',
};
