// Procurement shell: page header, rate card, page grid, empty/loading states.
// Shapes follow the orders page header (white strip, 40px round back button,
// bold 20px title) and the profile language sheet (radio rows).
export const procurementShellClasses = {
  // --- header ---
  header: {
    mobile: 'bg-white px-4 pt-3 pb-3 flex flex-col gap-3',
    web: 'flex items-center justify-between gap-4 flex-wrap',
  },
  headerRow: 'flex items-center gap-3',
  backBtn:
    'w-10 h-10 rounded-full bg-fill flex items-center justify-center flex-none text-navy',
  title: {
    mobile: 'flex-1 min-w-0 text-[20px] font-bold text-ink leading-tight',
    web: 'text-[24px] font-[800] leading-tight tracking-[-0.02em] text-ink',
  },
  newOrderIconBtn:
    'w-10 h-10 rounded-full bg-[#EDEBF7] text-navy flex items-center justify-center flex-none',
  // Active order chip (mobile) — whole row is the tap target for the orders sheet.
  orderChip:
    'w-full min-h-[44px] px-3 py-[10px] rounded-[12px] bg-fill flex items-center gap-[10px] text-left normal-case justify-start',
  orderChipIcon: 'w-[18px] h-[18px] text-navy flex-none',
  orderChipName:
    'flex-1 min-w-0 truncate text-[14px] font-semibold text-ink text-left',
  orderChipChevron: 'w-[18px] h-[18px] text-muted flex-none',
  // Desktop: order switcher + new order on the right of the title.
  webActions: 'flex items-center gap-3 min-w-0',
  orderSwitch:
    'h-11 max-w-[340px] min-w-0 px-4 rounded-[12px] bg-white !border !border-solid !border-hairline hover:!border-navy flex items-center gap-[10px] normal-case text-left',
  orderSwitchName: 'min-w-0 truncate text-[14px] font-semibold text-ink',
  newOrderBtn:
    'h-11 px-4 rounded-[12px] bg-navy text-white text-[14px] font-semibold normal-case flex items-center gap-2 flex-none',

  // --- rate card ---
  rateCard: {
    mobile: 'bg-white rounded-[16px] px-4 py-3 flex flex-col gap-2',
    web: 'bg-white border border-hairline rounded-[18px] px-5 py-4 flex flex-col gap-2',
  },
  rateLabel:
    'text-[12px] font-bold uppercase tracking-[0.06em] text-muted leading-4',
  rateRow: 'flex items-center gap-2 min-w-0',
  rateFrom:
    'text-[15px] font-semibold text-ink whitespace-nowrap flex-none tabular-nums',
  rateInputWrap: 'flex-1 min-w-0',
  rateReadOnly:
    'flex-1 min-w-0 h-11 px-3 rounded-[12px] bg-fill flex items-center text-[15px] font-semibold text-ink tabular-nums',
  currencyBtn:
    'h-11 px-3 rounded-[12px] bg-[#EDEBF7] text-navy text-[14px] font-bold normal-case flex items-center gap-1 flex-none',
  currencyIcon: 'w-4 h-4',
  rateHint: 'text-[12px] text-muted leading-[1.4]',
  rateHintError: 'text-[12px] text-red leading-[1.4]',

  // Currency sheet rows (profile language sheet geometry).
  currencyList: 'flex flex-col gap-[10px] pb-2',
  currencyRow:
    'flex items-center gap-[14px] min-h-[56px] rounded-[14px] px-4 !border-[1.5px] !border-solid normal-case w-full',
  currencyRowIdle: '!border-hairline bg-white',
  currencyRowActive: '!border-navy bg-[#F7F6FC]',
  currencyCode:
    'w-12 h-8 rounded-[8px] bg-fill flex items-center justify-center text-[13px] font-bold text-navy flex-none',
  currencyName: 'flex-1 min-w-0 text-left text-[15px] text-ink',
  currencyRate: 'text-[13px] text-muted tabular-nums flex-none',
  radio: 'w-6 h-6 rounded-full flex items-center justify-center flex-none',
  radioIdle: 'border-[1.5px] border-[#D7D6E0]',
  radioActive: 'bg-navy',
  radioIcon: 'w-[15px] h-[15px] text-white',

  // --- page grid (desktop) ---
  // DOM order is aside (rate + workflow) first so it sits on top below lg;
  // from lg it moves to a sticky 360px right column.
  grid: 'w-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start',
  main: 'flex flex-col gap-4 min-w-0 lg:col-start-1 lg:row-start-1',
  aside:
    'flex flex-col gap-4 min-w-0 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-[88px]',

  // --- empty / loading ---
  emptyCard: {
    mobile:
      'bg-white rounded-[16px] flex flex-col items-center text-center gap-2 py-10 px-6',
    web: 'bg-white border border-hairline rounded-[18px] flex flex-col items-center text-center gap-2 py-14 px-8 max-w-[560px] w-full mx-auto',
  },
  emptyTitle: 'text-[17px] font-bold text-ink',
  emptyText: 'text-[14px] text-muted max-w-[340px] mb-2',
  skeleton: 'bg-white rounded-[16px] animate-pulse',
  skeletonBar: 'bg-fill rounded-full',

  // --- toast / overlay ---
  overlay:
    'fixed inset-0 z-[2000] flex items-center justify-center bg-white/60 backdrop-blur-[1px]',
  overlayBox:
    'w-16 h-16 rounded-[18px] bg-white shadow-[0_8px_30px_rgba(23,22,29,0.12)] flex items-center justify-center',
};
