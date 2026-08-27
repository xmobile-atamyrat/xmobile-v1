export const appbarClasses = {
  boxes: {
    form: {
      web: 'flex items-center min-w-[200px] h-[56px] border-[1px] border-[#00000025] rounded-[10px] text-[#000] justify-between px-[24px] py-[18px]',
      mobile: 'flex items-center gap-2.5 px-5 pb-4 bg-white',
    },
    logo: {
      web: 'flex items-center justify-center w-[146px] h-100%',
      mobile: 'flex items-center justify-center w-[100px] h-100%',
    },
    header: {
      mobile: 'flex items-center justify-between px-5 pt-2 pb-[14px] bg-white',
    },
    deliverTo: {
      mobile: 'flex items-center gap-1',
    },
    guestGreeting: {
      mobile: 'flex flex-col',
    },
    search: 'flex w-fit h-full items-center justify-center',
    lang: {
      web: 'flex flex-row justify-start w-full items-center px-[12px] gap-[10px]',
      mobile: 'flex flex-row justify-start gap-1 w-full items-center',
    },
    toolbar: 'flex w-fit h-full items-center justify-start',
  },
  paper: {
    web: 'flex items-center rounded-2xl p-[2px_4px] justify-between w-full h-full',
    mobile:
      'flex-1 flex items-center gap-2.5 h-12 bg-[#F5F5F8] rounded-[14px] px-4',
  },
  inputBase: {
    web: 'flex w-full text-[#303030] [&_.MuiInputBase-input]:text-[#303030]',
    mobile:
      'flex w-full text-[#8B8A98] leading-[100%] text-[15px] font-normal placeholder-[#8B8A98]',
  },
  toolBar: 'flex items-center justify-between',
  arrowBackIos: {
    web: `w-[28px] h-[28px] text-[#303030] mx-auto`,
    mobile: `w-[24px] h-[24px] left-4`,
  },
  menuIcon: {
    web: `w-[34px] h-[34px] text-[#303030]`,
    mobile: `w-[30px] h-[30px]`,
  },
  menuItem: {
    web: 'px-[12px] gap-[10px]',
    mobile: 'px-2',
  },
  typography: {
    web: 'text-[#303030] text-[14px] text-regular leading-[20px] tracking-normal',
    mobile: 'text-[14px]',
  },
  shoppingCCI: {
    web: 'w-[28px] h-[28px] text-[#303030]',
    mobile: 'w-[30px] h-[30px]',
  },
  accCircle: {
    web: 'w-[42px] h-[42px]',
    mobile: 'w-[36px] h-[36px]',
  },
  menuItemAcc: 'flex flex-row gap-2 items-center justify-start',
  select: {
    // sits on the navy utility bar: white value + white dropdown caret
    web: 'h-[28px] border-0 text-white [&_.MuiSvgIcon-root]:text-white [&_.MuiSelect-select]:py-0 [&_.MuiSelect-select]:pl-0',
    mobile: 'w-[80px] h-[36px]',
  },
  appbar: {
    web: 'bg-white top-0 z-50 shadow-none',
    mobile: 'sticky top-0 z-40 bg-white border-b border-[#ECECF1] pt-3',
  },
  // ---- Web header (spec 1281-1315): navy utility bar / main header / category bar.
  // Each row bleeds past Layout's px-[2vw] container so backgrounds and
  // hairlines run edge to edge like the design, then re-pads its own content.
  web: {
    bleed: '-mx-[2vw] px-[2vw]',
    utilityBar:
      'h-[40px] bg-navy flex flex-row items-center justify-between gap-6 text-[13px]',
    // The full right-hand group needs ~625px; below xl the phone drops out and
    // below lg the social icons do, so the address never gets squeezed off.
    utilityGroup:
      'flex flex-row items-center gap-3 xl:gap-[26px] flex-shrink-0',
    utilityItem:
      'flex flex-row items-center gap-1.5 text-[13px] text-white/[0.86] hover:text-white transition-colors whitespace-nowrap cursor-pointer',
    utilityItemPhone: 'hidden xl:flex',
    utilityIcon: 'w-[15px] h-[15px] flex-shrink-0',
    utilityAddress: 'text-[13px] font-semibold text-white truncate',
    utilitySocial: 'hidden lg:flex flex-row items-center gap-1',
    utilitySocialButton:
      'w-[26px] h-[26px] flex items-center justify-center rounded-full text-white/[0.86] hover:bg-white/[0.12] hover:text-white transition-colors',

    utilityAddressGroup:
      'flex flex-row items-center gap-2 min-w-0 text-white/[0.86]',

    mainBar:
      'h-[84px] bg-white border-b border-[#F0EFF4] flex flex-row items-center gap-[36px]',
    backButton:
      'w-[38px] h-[38px] rounded-full bg-fill flex items-center justify-center flex-shrink-0 hover:bg-hairline transition-colors',
    backIcon: 'w-5 h-5 text-navy',
    // Spec sizes (logo 44px, account icon 22px, action icons 24px) are ratios of
    // the ~1500px viewport the design was drawn at. Held as clamp(floor, ratio,
    // cap) so narrow screens keep the exact spec number, wide screens keep the
    // design's proportions, and ultrawide stops growing.
    logo: 'h-[clamp(44px,2.9vw,56px)] w-auto cursor-pointer flex-shrink-0',

    // The design's 760px cap is 50% of the viewport it was drawn at (~1500px).
    // Held as a ratio instead of a fixed px so the search keeps the same share
    // of the row on wider screens rather than stranding ~700px of dead space.
    searchForm:
      'flex-1 max-w-[50vw] min-w-[280px] flex flex-row items-stretch h-[52px] border-2 border-navy rounded-[14px] overflow-hidden bg-white',
    searchScope:
      'flex flex-row items-center gap-2 px-[18px] text-[14px] font-semibold text-navy border-r border-hairline whitespace-nowrap flex-shrink-0 hover:bg-fill transition-colors',
    searchField: 'flex-1 flex flex-row items-center gap-2.5 px-4 min-w-0',
    searchInput:
      'flex-1 w-full text-[15px] text-ink [&_.MuiInputBase-input]:p-0 [&_.MuiInputBase-input]:h-auto [&_.MuiInputBase-input::placeholder]:text-[#B6B5C2] [&_.MuiInputBase-input::placeholder]:opacity-100',
    searchSubmit:
      'px-[28px] bg-red text-white text-[15px] font-semibold flex flex-row items-center gap-2 flex-shrink-0 hover:bg-[#C81926] transition-colors',

    actions: 'flex flex-row items-center gap-[26px] ml-auto flex-shrink-0',
    account:
      'flex flex-row items-center gap-[clamp(10px,0.66vw,13px)] cursor-pointer hover:opacity-80 transition-opacity',
    accountIcon:
      'w-[clamp(22px,1.45vw,28px)] h-[clamp(22px,1.45vw,28px)] text-navy flex-shrink-0',
    accountLabel: 'text-[clamp(11px,0.73vw,14px)] leading-[1.2] text-muted',
    accountValue:
      'text-[clamp(13px,0.86vw,16px)] leading-[1.2] font-semibold text-ink',
    iconAction:
      'text-navy hover:opacity-70 transition-opacity flex items-center justify-center',
    actionIcon: 'w-[clamp(24px,1.6vw,30px)] h-[clamp(24px,1.6vw,30px)]',

    categoryBar:
      'h-[52px] bg-white border-b border-[#F0EFF4] flex flex-row items-center gap-2',
    categoryMenuButton:
      'flex flex-row items-center gap-2 h-[36px] px-4 bg-navy text-white rounded-[10px] text-[14px] font-semibold flex-shrink-0 hover:bg-[#1A1258] transition-colors',
    // Open state (spec :2253): the tab squares off into the mega menu below it.
    categoryMenuButtonOpen: 'rounded-b-none',
    categoryList:
      'flex flex-row items-center gap-1 ml-2 min-w-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]',
    categoryChip:
      'px-[14px] py-2 rounded-[8px] text-[14px] whitespace-nowrap transition-colors',
    categoryChipActive: 'text-navy font-semibold bg-[#F3F2F8]',
    categoryChipInactive: 'text-[#4A4959] font-medium hover:bg-fill',
  },
  backButton: {
    web: 'hidden',
    mobile: 'flex justify-center',
  },
  // Circular white back button matching the product detail page.
  backButtonCircle: {
    web: 'hidden',
    mobile:
      'w-10 h-10 rounded-full bg-white shadow-[0_2px_10px_rgba(20,16,60,0.10)] flex items-center justify-center active:scale-95 transition-transform flex-shrink-0',
  },
  backIconCircle: {
    web: 'hidden',
    mobile: 'w-5 h-5 text-navy',
  },
  filterButton: {
    mobile:
      'w-12 h-12 rounded-[14px] bg-[#20166E] flex items-center justify-center text-white',
  },
  notificationButton: {
    mobile:
      'relative w-11 h-11 rounded-full bg-[#F5F5F8] flex items-center justify-center',
  },
  guestSignInButton: {
    mobile:
      'flex-shrink-0 rounded-full bg-[#20166E] text-white text-[14px] font-bold px-5 h-10 flex items-center justify-center active:scale-95 transition-transform',
  },
};
