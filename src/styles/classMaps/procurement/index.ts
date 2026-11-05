// Procurement (superuser) — shared building blocks. Built from the same tokens
// and shapes as the redesigned customer pages so the tool reads as part of the
// app: orders page header (round back button + bold title + pill tabs on a
// white strip over `bg-fill`), profile cards (white, radius 16, hairline rows),
// the language bottom sheet, and the dark toast pill (classMaps/components/snackbar).
//
// Per-panel class maps live next to this file (products.ts, prices.ts, ...) so
// each component owns its own file. Put only what 2+ components share here.
export const procurementClasses = {
  page: {
    mobile: 'w-full flex flex-col flex-1 min-h-screen bg-fill',
    web: 'w-full flex flex-col pt-7 pb-12 gap-5 max-w-[1200px] mx-auto',
  },
  content: {
    // pb-24 keeps the last row clear of Layout's floating chat button.
    mobile: 'w-full px-4 pt-4 pb-24 flex flex-col gap-3 min-w-0',
    web: 'w-full flex flex-col gap-5 min-w-0',
  },

  // --- cards / lists ---
  card: 'bg-white rounded-[16px] overflow-hidden',
  cardWeb: 'bg-white border border-hairline rounded-[18px] overflow-hidden',
  cardPadded: 'bg-white rounded-[16px] p-4 flex flex-col gap-3',
  row: 'flex items-center gap-3 px-4 min-h-[56px] w-full',
  rowBorder: 'border-b border-fill',
  rowTitle: 'flex-1 min-w-0 text-[15px] font-medium text-ink break-words',
  rowMeta: 'text-[12px] text-muted',
  sectionLabel:
    'text-[12px] font-bold uppercase tracking-[0.06em] text-muted mt-2 mb-[2px] ml-1',
  empty:
    'flex flex-col items-center text-center gap-2 py-10 px-6 text-muted text-[14px]',
  emptyIcon:
    'w-14 h-14 rounded-full bg-[#EDEBF7] flex items-center justify-center text-navy mb-1',

  // --- pills (tabs, chips) — same geometry as ordersIndexClasses.tab ---
  pills:
    'flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
  pill: 'px-4 py-2 rounded-full text-[13px] font-semibold normal-case whitespace-nowrap flex items-center gap-[6px] leading-4',
  pillActive: 'bg-navy text-white',
  pillIdle: 'bg-[#F3F2F8] text-[#4A4959]',
  pillCount: 'text-[11px] font-bold opacity-70',

  // --- buttons (ButtonBase) ---
  // `!border` because MUI ButtonBase's emotion `border: 0` wins otherwise.
  btnPrimary:
    'h-12 px-5 rounded-[14px] bg-navy text-white text-[15px] font-semibold normal-case flex items-center justify-center gap-2 disabled:opacity-50',
  btnSecondary:
    'h-12 px-5 rounded-[14px] bg-white !border-[1.5px] !border-solid !border-hairline text-ink text-[15px] font-semibold normal-case flex items-center justify-center gap-2 disabled:opacity-50',
  btnSoft:
    'h-11 px-4 rounded-[12px] bg-[#EDEBF7] text-navy text-[14px] font-semibold normal-case flex items-center justify-center gap-2',
  btnDanger:
    'h-12 px-5 rounded-[14px] bg-[#FDECEE] text-red text-[15px] font-semibold normal-case flex items-center justify-center gap-2',
  // 40x40 round icon button (≥40px touch target), like the orders back button.
  iconBtn:
    'w-10 h-10 rounded-full bg-fill flex items-center justify-center flex-none text-ink',
  iconBtnGhost:
    'w-10 h-10 rounded-full flex items-center justify-center flex-none text-muted',
  icon: 'w-[18px] h-[18px]',

  // --- bottom sheet / dialog (see components/ProcurementSheet.tsx) ---
  sheet: {
    mobile:
      'w-full rounded-t-[26px] bg-white pt-[10px] flex flex-col max-h-[92dvh]',
    web: 'w-[520px] max-w-[92vw] rounded-[20px] bg-white pt-[18px] flex flex-col max-h-[85vh]',
  },
  sheetFull: {
    mobile:
      'w-full h-[92dvh] rounded-t-[26px] bg-white pt-[10px] flex flex-col',
    web: 'w-[640px] max-w-[92vw] h-[80vh] rounded-[20px] bg-white pt-[18px] flex flex-col',
  },
  sheetHandle:
    'w-10 h-[5px] rounded-full bg-[#E4E3EB] mx-auto mt-[6px] mb-[14px] flex-none',
  sheetHeader:
    'flex items-center justify-between gap-3 px-[22px] mb-4 flex-none',
  sheetTitle: 'text-ink font-bold text-[19px] leading-tight',
  sheetSubtitle: 'text-muted text-[13px] mt-[2px]',
  sheetClose:
    'w-8 h-8 rounded-full bg-fill flex items-center justify-center flex-none',
  sheetBody: 'flex-1 min-h-0 overflow-y-auto px-[22px] pb-4',
  sheetFooter:
    'flex-none px-[22px] pt-3 pb-[max(20px,env(safe-area-inset-bottom))] border-t border-fill flex gap-3',
};

/** MUI TextField sx matching the redesigned inputs (radius 12, navy focus). */
export const procurementFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    backgroundColor: '#fff',
    fontSize: '15px',
    '& fieldset': { borderColor: '#ECECF1' },
    '&:hover fieldset': { borderColor: '#20166E' },
    '&.Mui-focused fieldset': { borderColor: '#20166E', borderWidth: '2px' },
  },
  '& .MuiInputBase-input': { py: '12px' },
};

/** Compact numeric field (quantities / prices) — 44px tall. */
export const procurementNumberFieldSx = {
  ...procurementFieldSx,
  '& .MuiInputBase-input': {
    py: '10px',
  },
};
