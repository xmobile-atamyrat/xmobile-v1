export const ordersComponentClasses = {
  orderCard: {
    web: 'hidden',
    mobile:
      'bg-white rounded-[16px] p-4 mb-3.5 shadow-[0_4px_14px_rgba(20,16,60,0.05)] cursor-pointer',
  },
  orderCardHeader: {
    web: 'hidden',
    mobile:
      'flex justify-between items-center pb-3 mb-2 border-b border-[#F4F3F7]',
  },
  orderCardNumber: {
    web: 'hidden',
    mobile: 'font-mono text-[12px] text-[#8B8A98]',
  },
  orderCardName: {
    web: 'hidden',
    mobile: 'font-semibold text-[14px] text-[#17161D] mb-1',
  },
  orderCardPhone: {
    web: 'hidden',
    mobile: 'font-normal text-[13px] text-[#8B8A98]',
  },
  orderCardAddress: {
    web: 'hidden',
    mobile: 'font-normal text-[13px] text-[#4A4959] mb-3',
  },
  orderCardFooter: {
    web: 'hidden',
    mobile: 'flex justify-between items-center',
  },
  orderCardDate: {
    web: 'hidden',
    mobile: 'font-normal text-[12px] text-[#8B8A98]',
  },
  orderCardPrice: {
    web: 'hidden',
    mobile: 'font-bold text-[15px] text-[#20166E]',
  },

  // --- Desktop order card (spec 1760-1789), rendered by `OrderWebCard.tsx`.
  // Web-only by construction, so no platform keys: mobile keeps the card above. ---
  webCard: {
    card: 'bg-white border border-hairline rounded-[18px] p-[22px] cursor-pointer transition-shadow hover:shadow-[0_10px_28px_rgba(20,16,60,0.07)]',
    head: 'flex flex-row items-center justify-between gap-4 pb-4 border-b border-[#F0EFF4]',
    meta: 'text-[12px] text-muted',
    metaNumber: 'font-mono font-bold text-ink',
    foot: 'flex flex-row items-center justify-between gap-4 pt-4 flex-wrap',
    thumbs: 'flex flex-row items-center',
    // 2px white ring + the -10px pull is what makes the stack read as overlap
    thumb:
      'w-11 h-11 rounded-[10px] bg-fill overflow-hidden border-2 border-white flex items-center justify-center flex-none -ml-[10px] first:ml-0',
    thumbImg: 'w-full h-full object-contain p-[3px]',
    thumbIcon: 'w-5 h-5 text-[#B6B5C2]',
    more: 'w-11 h-11 rounded-[10px] bg-fill border-2 border-white flex items-center justify-center flex-none -ml-[10px] text-[12px] font-bold text-[#4A4959]',
    total: 'text-[14px] text-[#4A4959] ml-3',
    totalValue: 'font-bold text-navy',
    // `!border` because MUI ButtonBase's emotion rule (`border: 0`) is injected
    // after the Tailwind sheet and wins at equal specificity.
    action:
      'h-[42px] px-5 rounded-[11px] !border-[1.5px] !border-solid !border-navy text-navy text-[14px] font-semibold flex flex-row items-center gap-[7px] normal-case flex-none',
  },
};
