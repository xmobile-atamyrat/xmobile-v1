export const ordersIndexClasses = {
  container: {
    web: 'flex flex-col w-full py-8',
    mobile: 'flex flex-col w-full min-h-screen bg-[#F5F5F8]',
  },
  headerWrap: {
    web: 'hidden',
    mobile: 'bg-white px-4 pt-3 pb-3',
  },
  backButton: {
    web: 'hidden',
    mobile:
      'w-10 h-10 rounded-full bg-[#F5F5F8] flex items-center justify-center flex-none',
  },
  title: {
    web: 'text-[30px] font-medium',
    mobile: 'text-[20px] font-bold',
  },
  tabs: {
    web: 'hidden',
    mobile: 'flex gap-2 mt-3',
  },
  tab: {
    web: 'hidden',
    mobile: 'px-4 py-2 rounded-full text-[13px] font-semibold normal-case',
  },
  tabActive: {
    web: 'hidden',
    mobile: 'bg-[#20166E] text-white',
  },
  tabInactive: {
    web: 'hidden',
    mobile: 'bg-[#F3F2F8] text-[#4A4959]',
  },
  content: {
    web: '',
    mobile: 'px-4 pt-4',
  },
  filters: {
    web: 'mb-6',
    mobile: 'hidden',
  },
  emptyState: {
    web: 'text-center py-12',
    mobile: 'text-center py-16',
  },
  emptyStateText: {
    web: 'text-[#8B8A98]',
    mobile: 'text-[#8B8A98] text-[14px]',
  },
  pagination: {
    web: 'mt-6 flex justify-center',
    mobile: 'mt-4 flex justify-center',
  },

  // --- Desktop order history (spec 1725-1790): 280px account rail + order
  // list. Horizontal padding comes from Layout's px-[2vw]; the rail lives in
  // `classMaps/user/accountNav.ts` and the cards in `orders/components.ts`.
  // The grid/title/rail geometry is kept in step with `profileClasses.web`. ---
  web: {
    grid: 'w-full grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-7 pt-7 pb-12 items-start',
    col: 'flex flex-col min-w-0',
    headRow: 'flex items-center justify-between gap-4 flex-wrap mb-[18px]',
    title: 'text-[24px] font-[800] leading-tight tracking-[-0.02em] text-ink',
    tabs: 'flex flex-row gap-2',
    // leading-4 pins the pill to the spec's 9+16+9 = 34px; MUI Button's 1.75
    // line-height would otherwise render it 41px (same fix as the search pills).
    tab: 'text-[13px] font-semibold px-4 py-[9px] rounded-full normal-case leading-4',
    tabActive: 'bg-navy text-white',
    // `!border` because these render on MUI ButtonBase, whose emotion rule
    // (`border: 0`) is injected after the Tailwind sheet and wins at equal
    // specificity. Same reason on every bordered ButtonBase below.
    tabIdle:
      'bg-white !border !border-solid !border-hairline text-[#4A4959] hover:!border-navy',
    filterBar:
      'flex flex-row items-center gap-3 flex-wrap bg-[#F7F6FA] border border-hairline rounded-[14px] px-4 py-[10px] mb-4',
    filterLabel: 'text-[13px] font-semibold text-[#4A4959] flex-none',
    filterDash: 'text-[13px] text-muted flex-none',
    clear: 'text-[13px] font-semibold text-red normal-case ml-auto flex-none',
    list: 'flex flex-col gap-4',
    empty:
      'bg-white border border-hairline rounded-[18px] py-16 flex justify-center',
    emptyText: 'text-[14px] text-muted',
    pagination: 'mt-7 flex justify-center',
  },
};
