// Procurement → Suppliers tab (components/SuppliersPanel.tsx). Rows follow the
// profile menu rows (38px icon tile · label) but grow to fit a wrapping name,
// the supplier's note and a status line of small badges.
export const suppliersClasses = {
  root: 'flex flex-col gap-3 min-w-0',
  header: 'flex items-center justify-between gap-3 min-w-0',
  headerTitle: 'text-[17px] font-bold text-ink leading-tight',
  headerCount: 'text-muted font-semibold ml-[6px]',
  // Mobile: one white card, rows separated by hairlines.
  // Web: a card per supplier, two columns from lg up.
  list: {
    mobile: 'bg-white rounded-[16px] overflow-hidden flex flex-col',
    web: 'grid grid-cols-1 lg:grid-cols-2 gap-3',
  },
  row: {
    mobile: 'flex items-start gap-[14px] pl-4 pr-2 py-3 min-h-[64px] w-full',
    web: 'bg-white border border-hairline rounded-[18px] flex items-start gap-[14px] pl-5 pr-3 py-4 min-h-[76px] w-full min-w-0',
  },
  rowBorder: 'border-b border-fill',
  tile: 'w-[38px] h-[38px] rounded-[11px] bg-[#EDEBF7] flex items-center justify-center flex-none',
  tileIcon: 'w-[19px] h-[19px] text-navy',
  body: 'flex-1 min-w-0 flex flex-col gap-[3px] pt-[1px]',
  name: 'text-[15px] font-semibold text-ink leading-[20px] break-words [overflow-wrap:anywhere]',
  description:
    'text-[13px] text-muted leading-[18px] break-words [overflow-wrap:anywhere] line-clamp-2',
  status: 'flex flex-wrap items-center gap-[6px] mt-[5px]',
  badge:
    'inline-flex items-center gap-1 h-6 px-2 rounded-full text-[12px] font-semibold leading-none whitespace-nowrap',
  badgeTone: {
    idle: 'bg-fill text-muted',
    partial: 'bg-fill text-[#4A4959]',
    complete: 'bg-[#EDEBF7] text-navy',
    cheapest: 'bg-[#E7F6EE] text-[#1A7F4B]',
  },
  badgeIcon: 'w-[13px] h-[13px]',
  remove:
    'w-10 h-10 rounded-full flex items-center justify-center flex-none text-muted hover:bg-fill hover:text-red',
  removeIcon: 'w-[18px] h-[18px]',
  emptyCard: {
    mobile: 'bg-white rounded-[16px]',
    web: 'bg-white border border-hairline rounded-[18px]',
  },
  emptyText: 'max-w-[340px] text-[14px] text-muted leading-[20px]',
  emptyAction: 'mt-3',
};
