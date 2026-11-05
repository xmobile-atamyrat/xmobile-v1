// Procurement catalog sheet (search the product / supplier base, add to the
// order, create, rename, delete). Shared tokens live in ./index.ts.
export const catalogClasses = {
  // Sticky inside ProcurementSheet's scrolling body (which pads 22px sideways),
  // so the search stays put while the results scroll under it.
  searchWrap: 'sticky top-0 z-10 bg-white pb-3 -mx-[22px] px-[22px]',
  search: 'flex items-center gap-2 h-12 pl-[14px] pr-1 rounded-[14px] bg-fill',
  searchIcon: 'w-[18px] h-[18px] text-muted flex-none',
  searchInput:
    'flex-1 min-w-0 h-full bg-transparent outline-none border-0 text-[16px] text-ink placeholder:text-[#B6B5C2]',
  searchClear:
    'w-10 h-10 rounded-full flex items-center justify-center flex-none text-muted',
  searchSpinner: 'w-10 h-10 flex items-center justify-center flex-none',

  // --- results ---
  list: 'flex flex-col',
  row: 'flex items-center gap-2 min-h-[60px] py-2 border-b border-fill last:border-b-0',
  rowText: 'flex-1 min-w-0',
  rowName:
    'text-[15px] font-medium text-ink leading-snug break-words [overflow-wrap:anywhere]',
  rowNote:
    'text-[12px] text-muted leading-snug mt-[2px] break-words [overflow-wrap:anywhere]',
  addBtn:
    'w-10 h-10 rounded-full bg-navy text-white flex items-center justify-center flex-none disabled:opacity-60',
  inOrder:
    'h-7 px-[10px] rounded-full bg-fill text-muted text-[12px] font-semibold flex items-center gap-1 flex-none whitespace-nowrap',
  moreBtn:
    'w-10 h-10 -mr-2 rounded-full flex items-center justify-center flex-none text-muted',

  // "Create “…” and add" — the prominent row when the name isn't in the base.
  createRow:
    'w-full flex items-center gap-3 p-3 mb-2 rounded-[14px] bg-[#EDEBF7] text-left normal-case justify-start disabled:opacity-60',
  createIcon:
    'w-10 h-10 rounded-full bg-navy text-white flex items-center justify-center flex-none',
  createTitle:
    'text-[15px] font-semibold text-navy leading-snug break-words [overflow-wrap:anywhere]',
  createHint: 'text-[12px] text-[#5B5592] mt-[2px]',

  // --- states ---
  state:
    'flex flex-col items-center text-center gap-2 pt-10 pb-6 px-4 text-muted text-[14px]',
  // Under the create row, so it stays one quiet line.
  nothing:
    'flex items-center justify-center gap-2 py-4 px-2 text-muted text-center',
  stateIcon:
    'w-14 h-14 rounded-full bg-[#EDEBF7] flex items-center justify-center text-navy mb-1',

  // --- per-item actions (bottom sheet on mobile, menu on web) ---
  actionRow:
    'w-full flex items-center gap-3 min-h-[52px] text-left normal-case justify-start text-[15px] font-medium text-ink',
  actionTile:
    'w-[38px] h-[38px] rounded-[12px] bg-fill flex items-center justify-center flex-none text-ink',
  actionTileDanger:
    'w-[38px] h-[38px] rounded-[12px] bg-[#FDECEE] flex items-center justify-center flex-none text-red',
  menuItem: 'gap-3 text-[14px] font-medium text-ink min-h-[44px]',
};
