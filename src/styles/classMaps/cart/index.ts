export const cartIndexClasses = {
  box: {
    web: 'w-full h-full flex flex-col pt-7 pb-12',
    mobile: 'w-full flex flex-col grow bg-fill pt-[36px]',
  },
  // mobile-only from step 56 on: the web tree builds its own header/columns
  // from the `web` group below instead of sharing these.
  cartHeader: {
    mobile: 'flex w-full justify-between items-center mb-[20px]',
  },
  prodCart: {
    mobile: 'flex flex-col grow w-full px-4 pt-[8px] pb-[70px]',
  },
  link: 'flex flex-row justify-center items-center gap-1 py-2 no-underline mx-2',
  iconButton: {
    web: 'text-[#fff] font-bold text-[16px] leading-[24px] tracking-normal m-0 normal-case',
    mobile: 'text-[#fff] font-medium text-[16px] leading-full tracking-normal',
  },
  breadcrumbs: {
    web: 'mb-[14px] flex flex-row',
    mobile: 'hidden',
  },
  breadcrumbsText:
    'no-underline text-muted text-[13px] leading-[20px] tracking-normal',
  emptyCart: {
    img: {
      web: 'w-[240px] h-[200px] mx-auto mt-[60px] mb-[28px] object-contain',
      mobile: 'w-[180px] h-[150px] mx-auto',
    },
    typo: {
      web: 'font-semibold text-[22px] leading-[30px] tracking-[-0.01em] text-ink text-center mb-[24px]',
      mobile:
        'mt-[38px] font-medium text-[20px] leading-[28px] tracking-normal text-[#000] text-center mb-[35px]',
    },
    link: {
      web: 'h-[54px] bg-navy hover:bg-[#1A1258] transition-colors duration-200 rounded-[14px] px-[40px] mb-[60px] flex justify-center items-center no-underline',
      mobile:
        'w-[88.7vw] h-[11.2vw] max-h-[48px] bg-[#20166E] rounded-[12px] py-[4px] px-[20px] gap-[16px] flex justify-center items-center no-underline',
    },
  },
  yourCartTypo: {
    mobile:
      'font-bold text-[24px] leading-tight tracking-[-0.01em] text-[#17161D] text-left',
  },
  cartCount: 'text-muted font-medium',
  cartClearBtn: 'text-[13px] font-semibold text-red cursor-pointer normal-case',

  // --- Desktop cart (spec 1584-1602). Horizontal padding comes from Layout's
  // px-[2vw] container, so only vertical rhythm and the two columns live here.
  web: {
    titleRow: 'flex flex-row items-baseline justify-between mb-[22px]',
    title: 'font-[800] text-[28px] leading-tight tracking-[-0.02em] text-ink',
    titleCount: 'text-[16px] font-medium text-muted',
    // 380px summary column (spec 1587). Below lg the summary drops under the
    // list rather than squeezing the line items.
    grid: 'grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-7 items-start',
    itemsCol: 'flex flex-col gap-[14px] min-w-0',
    summaryCol: 'flex flex-col gap-4 h-fit',
  },
};
