export const footerClasses = {
  boxes: {
    // Dark web footer (spec 2291-2317). Bleeds past Layout's px-[2vw] container
    // so the dark band runs edge to edge, then re-pads its own content — same
    // pattern as the Appbar rows. Must NOT carry w-full: an explicit width
    // stops the negative right margin from widening the box.
    mainWeb: {
      web: 'flex flex-col -mx-[2vw] px-[2vw] mt-[60px] pt-[48px] pb-[30px] bg-[#17131F] text-white',
      mobile: 'hidden',
    },
    mainMobile: {
      web: 'hidden',
      mobile:
        'justify-between bg-white w-full h-[64px] px-[18px] pt-[10px] pb-[12px] border-t border-hairline flex items-center',
    },
    main: {
      web: 'flex flex-col w-full',
      // mobile footer is only the fixed nav; its flow content is hidden, so no
      // top margin (that left a white tail below short pages — clearance is
      // applied once in Layout.tsx via mobileBottomNavHeight padding).
      mobile: 'flex flex-col w-full',
    },
    bottomNavigation: 'w-full flex',
  },
  navItem: {
    wrapper: 'flex-1 flex flex-col items-center gap-1',
    active: 'text-navy',
    inactive: 'text-[#B6B5C2]',
    icon: 'w-[24px] h-[24px]',
    labelActive: 'text-[10px] font-semibold text-center',
    labelInactive: 'text-[10px] font-medium text-center',
  },
  web: {
    // top trust strip
    trustRow:
      'flex flex-row flex-wrap items-center gap-x-[32px] gap-y-[20px] pb-[30px] border-b border-white/10 mb-[32px]',
    trustItem: 'flex flex-row items-center gap-[14px]',
    trustIcon:
      'w-[44px] h-[44px] rounded-[12px] bg-white/[0.08] flex items-center justify-center flex-shrink-0',
    trustTitle: 'text-[14px] font-semibold text-white leading-[1.3]',
    trustSub: 'text-[12px] text-white/55 leading-[1.4]',

    // link columns
    columns:
      'grid grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.4fr] gap-x-[32px] gap-y-[36px] pb-[32px] border-b border-white/10',
    brandLogo: 'h-[40px] w-auto mb-4 brightness-0 invert cursor-pointer',
    tagline: 'text-[13px] leading-[1.7] text-white/60 mb-[18px] max-w-[240px]',
    socialRow: 'flex flex-row gap-[10px]',
    socialButton:
      'w-[38px] h-[38px] rounded-[10px] bg-white/[0.08] flex items-center justify-center text-white hover:bg-white/[0.16] transition-colors',
    colTitle: 'text-[13px] font-bold text-white mb-[14px]',
    colList: 'flex flex-col gap-[11px] items-start',
    colLink:
      'text-[13px] leading-[1.4] text-white/60 hover:text-white transition-colors text-left cursor-pointer',
    contactList: 'flex flex-col gap-[14px]',
    contactRow: 'flex flex-row items-start gap-2.5 text-[13px] text-white/60',
    contactIcon: 'w-[15px] h-[15px] mt-[3px] flex-shrink-0 text-white/45',
    contactStack: 'flex flex-col gap-1 min-w-0',
    contactLink:
      'text-[13px] leading-[1.5] text-white/60 hover:text-white transition-colors',
    contactText: 'text-[13px] leading-[1.5] text-white/60',

    // bottom bar
    bottomBar:
      'flex flex-row flex-wrap items-center justify-between gap-[14px] pt-[22px]',
    copyright: 'text-[12px] text-white/50',
    // pr clears the chat FAB (fixed bottom-[24px] right-[24px], 56px wide),
    // which floats over the footer's bottom-right corner at page end.
    bottomRight: 'flex flex-row items-center gap-[18px] flex-wrap pr-[72px]',
    bottomLink:
      'text-[12px] text-white/50 hover:text-white transition-colors cursor-pointer',
    // Only real payment method: cash on delivery — no card-network logos.
    payBadge:
      'h-[26px] px-[10px] rounded-[6px] bg-white/10 flex items-center text-[11px] font-semibold text-white/75 whitespace-nowrap',
  },
};
