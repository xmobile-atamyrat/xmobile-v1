export const saleClasses = {
  price: {
    root: {
      cardWeb: 'flex flex-col items-start gap-[3px] min-w-0',
      cardMobile: 'flex flex-col items-start gap-[2px] min-w-0',
      tile: 'flex flex-col items-start gap-[3px] mt-1',
      detailWeb: 'flex flex-row flex-wrap items-center gap-x-3 gap-y-2',
      detailMobile: 'flex flex-row flex-wrap items-center gap-x-[10px] gap-y-1',
    },
    old: {
      cardWeb: 'text-[14px] font-medium leading-none text-muted line-through',
      cardMobile:
        'text-[11px] font-medium leading-none text-muted line-through',
      tile: 'text-[13px] font-medium leading-none text-muted line-through',
      detailWeb:
        'text-[19px] font-semibold leading-none text-muted line-through',
      detailMobile:
        'text-[16px] font-semibold leading-none text-muted line-through',
    },
    current: 'flex flex-row items-baseline whitespace-nowrap',
    amount: {
      cardWeb: 'font-bold text-[24px] leading-none',
      cardMobile: 'font-bold text-[15px] leading-none',
      tile: 'font-bold text-[18px] leading-none',
      detailWeb: 'font-[800] text-[32px] leading-none tracking-[-0.02em]',
      detailMobile: 'font-bold text-[26px] leading-none',
    },
    unit: {
      cardWeb: 'text-[13px] font-normal text-muted ml-1',
      cardMobile: 'text-[10px] font-normal text-muted ml-1',
      tile: 'text-[13px] font-normal text-muted ml-1',
      detailWeb: 'text-[16px] font-semibold text-muted ml-[10px]',
      detailMobile: 'text-[13px] font-medium text-muted ml-2',
    },
    sparkle: {
      cardWeb: 'w-3 h-3',
      cardMobile: 'w-[9px] h-[9px]',
      tile: 'w-[10px] h-[10px]',
      detailWeb: 'w-4 h-4',
      detailMobile: 'w-[14px] h-[14px]',
    },
    sparkleBase:
      'self-start shrink-0 ml-[2px] text-[#FF9F1C] fill-current motion-safe:animate-sale-twinkle',
  },
  // Solid red, and the text only turns transparent where the browser can clip
  // the gradient to it, so it stays readable everywhere else. Reduced motion
  // keeps the solid colour.
  shine:
    'inline-block text-red motion-safe:supports-[(-webkit-background-clip:text)]:bg-[linear-gradient(110deg,#E41E2B_40%,#FF9F1C_50%,#E41E2B_60%)] motion-safe:supports-[(-webkit-background-clip:text)]:bg-[length:200%_100%] motion-safe:supports-[(-webkit-background-clip:text)]:[-webkit-background-clip:text] motion-safe:supports-[(-webkit-background-clip:text)]:[background-clip:text] motion-safe:supports-[(-webkit-background-clip:text)]:[-webkit-text-fill-color:transparent] motion-safe:supports-[(-webkit-background-clip:text)]:animate-sale-shine forced-colors:![-webkit-text-fill-color:currentColor]',
  percent: {
    base: 'inline-flex items-center shrink-0 rounded-full bg-red text-white font-bold leading-none whitespace-nowrap',
    size: {
      web: 'text-[12px] px-2 py-[5px]',
      mobile: 'text-[10px] px-[6px] py-[3px]',
      chip: 'text-[11px] px-[6px] py-[3px]',
    },
  },
  // Outlined, so it can't be read as a discount on the price shown beside it.
  otherModel: {
    base: 'inline-flex items-center max-w-full rounded-full bg-white/95 border border-solid border-red text-red font-bold leading-none',
    size: {
      web: 'gap-1 text-[11px] px-2 py-1',
      mobile: 'gap-[3px] text-[10px] px-[6px] py-[2px]',
    },
    icon: {
      web: 'w-[14px] h-[14px] shrink-0',
      mobile: 'w-3 h-3 shrink-0',
    },
    text: 'truncate py-[1px]',
  },
  // The home promo tile. Its content stays narrow to keep clear of the image.
  tile: {
    eyebrowRow: 'flex flex-row items-center gap-2',
    otherModel: 'flex max-w-[190px] mt-2',
  },
  // Top-left of the card image; the width leaves room for the favourite button.
  // Staff also get the stale-price pill in that corner, so the badge sits
  // under it there.
  cardBadge: {
    base: 'absolute left-2 flex max-w-[calc(100%-56px)]',
    top: 'top-2',
    belowStale: {
      web: 'top-9',
      mobile: 'top-8',
    },
  },
};
