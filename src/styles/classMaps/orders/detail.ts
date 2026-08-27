export const ordersDetailClasses = {
  container: {
    web: 'flex flex-col w-full py-4',
    mobile: 'flex flex-col w-full min-h-screen bg-[#F5F5F8]',
  },
  header: {
    web: 'flex items-center gap-4 mb-4',
    mobile: 'flex items-center gap-3 bg-white px-4 pt-3 pb-3',
  },
  backButton: {
    web: 'hidden',
    mobile:
      'w-10 h-10 rounded-full bg-[#F5F5F8] flex items-center justify-center flex-none',
  },
  headerTitle: {
    web: 'hidden',
    mobile: 'text-[20px] font-bold leading-tight',
  },
  headerOrderNumber: {
    web: 'hidden',
    mobile: 'text-[12px] text-[#8B8A98] font-mono',
  },
  content: {
    web: 'hidden',
    mobile: 'flex flex-col px-4 pt-4 pb-6 gap-[14px]',
  },
  card: {
    web: 'hidden',
    mobile:
      'bg-white rounded-[16px] p-4 shadow-[0_4px_14px_rgba(20,16,60,0.05)]',
  },
  statusRow: {
    web: 'hidden',
    mobile: 'flex items-center justify-between gap-3',
  },
  statusDate: {
    web: 'hidden',
    mobile: 'text-[12px] text-[#8B8A98]',
  },
  cardLabel: {
    web: 'hidden',
    mobile:
      'text-[12px] font-bold uppercase tracking-[0.06em] text-[#8B8A98] mb-3',
  },
  itemRow: {
    web: 'hidden',
    mobile:
      'flex items-start justify-between gap-3 py-[14px] border-b border-[#F4F3F7] first:pt-0 last:pb-0 last:border-0',
  },
  itemName: {
    web: 'hidden',
    mobile: 'text-[14px] font-semibold text-[#17161D]',
  },
  itemMeta: {
    web: 'hidden',
    mobile: 'flex items-center gap-2 text-[12px] text-[#8B8A98] mt-[2px]',
  },
  itemPrice: {
    web: 'hidden',
    mobile: 'text-[14px] font-bold text-[#20166E] whitespace-nowrap',
  },
  totalRow: {
    web: 'hidden',
    mobile: 'flex items-center justify-between',
  },
  totalLabel: {
    web: 'hidden',
    mobile: 'text-[15px] font-bold text-[#17161D]',
  },
  totalValue: {
    web: 'hidden',
    mobile: 'text-[18px] font-extrabold text-[#20166E]',
  },
  infoRow: {
    web: 'hidden',
    mobile:
      'flex gap-3 py-[14px] border-b border-[#F4F3F7] first:pt-0 last:pb-0 last:border-0',
  },
  infoTitle: {
    web: 'hidden',
    mobile: 'text-[13px] font-bold text-[#17161D] mb-[2px]',
  },
  infoText: {
    web: 'hidden',
    mobile: 'text-[12px] text-[#8B8A98] leading-[1.5]',
  },
  cancelButton: {
    web: 'hidden',
    mobile:
      'h-[50px] w-full rounded-[13px] border-[1.5px] border-[#E41E2B] text-[#E41E2B] font-semibold text-[14px] normal-case',
  },

  // --- Desktop order detail. The mockup has no dedicated web detail screen
  // (spec 1725-1790 stops at the history list), so this reuses the account
  // section's rail + card language and the confirmation page's summary card
  // (`classMaps/cart/checkoutSuccess.ts` web block) so the three read as one. ---
  web: {
    grid: 'w-full grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-7 pt-7 pb-12 items-start',
    col: 'flex flex-col min-w-0',
    headRow: 'flex flex-row items-start justify-between gap-4 mb-[18px]',
    title:
      'text-[24px] font-[800] leading-tight tracking-[-0.02em] text-ink mb-1',
    orderNumber: 'text-[13px] font-mono text-muted',
    body: 'grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-5 items-start',
    card: 'bg-white border border-hairline rounded-[18px] p-[22px]',
    eyebrow:
      'text-[12px] font-bold uppercase tracking-[0.06em] text-muted mb-[14px]',
    itemRow:
      'flex flex-row items-center gap-3 py-[14px] border-b border-[#F4F3F7] first:pt-0 last:border-0',
    thumb:
      'w-[52px] h-[52px] rounded-[11px] bg-fill overflow-hidden flex-none flex items-center justify-center',
    thumbImg: 'w-full h-full object-contain p-1',
    thumbIcon: 'w-6 h-6 text-[#B6B5C2]',
    itemBody: 'flex flex-col flex-1 min-w-0',
    itemName: 'text-[14px] font-semibold text-ink line-clamp-2',
    itemMeta:
      'flex flex-row items-center gap-2 flex-wrap text-[12px] text-muted mt-[3px]',
    itemPrice: 'text-[14px] font-bold text-navy whitespace-nowrap',
    totals: 'flex flex-col gap-2 pt-[14px]',
    totalsRow: 'flex flex-row justify-between text-[13px] text-[#4A4959]',
    free: 'font-semibold text-[#1F8A5B]',
    grandRow:
      'flex flex-row justify-between items-baseline pt-3 mt-1 border-t border-[#F4F3F7]',
    grandLabel: 'text-[15px] font-bold text-ink',
    grandValue: 'text-[18px] font-[800] text-navy',
    sideCol: 'flex flex-col gap-4',
    sideHead: 'flex flex-row items-center gap-[10px] mb-2',
    sideIcon: 'w-5 h-5 text-navy flex-none',
    sideIconGreen: 'w-5 h-5 text-[#1F8A5B] flex-none',
    sideTitle: 'text-[14px] font-bold text-ink',
    sideText: 'text-[13px] leading-[1.6] text-[#4A4959]',
    sideMuted: 'text-[13px] leading-[1.6] text-muted',
    metaRow: 'flex flex-row justify-between gap-3 text-[13px] py-[6px]',
    metaKey: 'text-muted flex-none',
    metaValue: 'text-[#4A4959] text-right',
    // `!border`: MUI ButtonBase's emotion `border: 0` is injected after the
    // Tailwind sheet and wins at equal specificity.
    cancelButton:
      'h-[46px] px-5 rounded-[12px] !border-[1.5px] !border-solid !border-red text-red text-[14px] font-semibold normal-case flex-none',
  },
};
