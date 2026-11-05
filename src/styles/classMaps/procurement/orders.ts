// Procurement → orders sheet (components/OrdersSheet.tsx + components/orders/).
// Shared shapes (sheet, buttons, empty state) come from ./index.ts.
export const procurementOrdersClasses = {
  search: 'sticky top-0 z-[1] bg-white pb-3',
  list: 'flex flex-col gap-[10px]',

  // --- order card: select area + "⋯" button ---
  card: 'flex items-stretch w-full rounded-[16px] bg-white !border-[1.5px] !border-solid min-w-0',
  cardIdle: '!border-hairline',
  cardActive: '!border-navy bg-[#F7F6FC]',
  cardMain:
    'flex-1 min-w-0 flex items-start gap-3 py-3 pl-3 pr-1 text-left justify-start rounded-l-[16px]',
  tile: 'w-[38px] h-[38px] rounded-[12px] flex items-center justify-center flex-none',
  tileIdle: 'bg-fill text-muted',
  tileActive: 'bg-navy text-white',
  body: 'flex-1 min-w-0 flex flex-col gap-[6px]',
  titleRow: 'flex items-start gap-2 min-w-0',
  name: 'flex-1 min-w-0 text-[15px] font-semibold text-ink leading-[20px] break-words [overflow-wrap:anywhere]',
  openBadge:
    'flex-none mt-[1px] px-2 py-[2px] rounded-full bg-navy text-white text-[11px] font-bold leading-4',
  metaRow: 'flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0',
  currency:
    'px-[7px] py-[1px] rounded-[6px] bg-[#F3F2F8] text-[#4A4959] text-[11px] font-bold leading-4 tracking-[0.02em]',
  meta: 'text-[12px] text-muted leading-4 whitespace-nowrap',
  more: 'w-10 h-10 rounded-full flex items-center justify-center flex-none text-muted self-center mr-1',

  // --- "⋯" menu ---
  menuPaper: 'rounded-[14px] min-w-[200px] mt-1',
  menuItem: 'min-h-[44px] gap-3 text-[14px] font-medium text-ink',
  menuItemDanger: 'min-h-[44px] gap-3 text-[14px] font-medium text-red',
};
