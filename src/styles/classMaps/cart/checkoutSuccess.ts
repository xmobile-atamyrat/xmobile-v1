export const checkoutSuccessClasses = {
  container: {
    mobile: 'flex flex-col w-full h-[80vh] items-center justify-center px-6',
  },
  // Nested success check badge (mobile) — 96px pale-green ring around a 64px green disc
  badgeOuter: {
    mobile:
      'w-24 h-24 rounded-full bg-[#E9F6EE] flex items-center justify-center mb-6',
  },
  badgeInner: {
    mobile:
      'w-16 h-16 rounded-full bg-[#1F9A5B] flex items-center justify-center',
  },
  title: {
    mobile:
      'font-bold text-[26px] leading-[32px] tracking-[-0.01em] text-[#17161D] text-center mb-2.5',
  },
  message: {
    mobile: 'text-center mb-8 px-2',
  },
  orderNumber: {
    mobile: 'font-bold text-[15px] leading-[22px] text-[#20166E]',
  },
  yourOrder: {
    mobile: 'font-normal text-[15px] leading-[22px] text-[#8B8A98] text-center',
  },
  confirmation: {
    mobile:
      'font-normal text-[15px] leading-[22px] text-[#8B8A98] text-center mt-2',
  },
  buttonContainer: {
    mobile: 'flex flex-col gap-3 w-full max-w-[380px]',
  },
  buttonPrimary: {
    mobile:
      'text-white font-semibold text-[16px] leading-normal rounded-[15px] h-[54px] w-full normal-case',
  },
  buttonSecondary: {
    mobile:
      'bg-white font-semibold text-[16px] leading-normal rounded-[15px] h-[54px] w-full normal-case border-[1.5px] border-solid border-[#E4E3EB]',
  },

  // --- Desktop confirmation (spec 2186-2211). Horizontal padding comes from
  // Layout's px-[2vw]; the content itself is a centred 760px column. ---
  web: {
    page: 'w-full max-w-[760px] mx-auto pt-11 pb-12',
    head: 'flex flex-col items-center text-center mb-8',
    badge:
      'w-[72px] h-[72px] rounded-full bg-[#E7F4EC] text-[#1F8A5B] flex items-center justify-center mb-[18px]',
    title:
      'font-[800] text-[30px] leading-tight tracking-[-0.02em] text-ink mb-2',
    sub: 'text-[15px] leading-[1.6] text-muted max-w-[560px]',
    orderNumber: 'font-bold text-navy',
    // 1.4fr | 1fr (spec 2193); stacks below md so the summary stays readable
    grid: 'grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-5 items-start',
    card: 'bg-white border border-hairline rounded-2xl p-[22px]',
    eyebrow:
      'text-[12px] font-bold uppercase tracking-[0.06em] text-muted mb-[14px]',
    itemRow:
      'flex flex-row items-center gap-3 py-[14px] border-b border-[#F4F3F7]',
    thumb:
      'w-[52px] h-[52px] rounded-[11px] bg-fill overflow-hidden flex-shrink-0 flex items-center justify-center',
    thumbImg: 'w-full h-full object-contain p-1',
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
    sideIcon: 'w-5 h-5 text-navy flex-shrink-0',
    sideIconGreen: 'w-5 h-5 text-[#1F8A5B] flex-shrink-0',
    sideTitle: 'text-[14px] font-bold text-ink',
    sideBody: 'text-[13px] leading-[1.6] text-[#4A4959]',
    primaryBtn:
      'w-full h-[50px] rounded-[13px] text-[15px] font-semibold gap-2 normal-case',
    secondaryBtn:
      'w-full h-[50px] rounded-[13px] bg-white border-[1.5px] border-solid border-[#E4E3EB] text-[15px] font-semibold normal-case',
  },
};
