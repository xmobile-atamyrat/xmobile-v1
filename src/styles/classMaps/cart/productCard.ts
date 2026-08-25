export const cartProductCardClasses = {
  // Spec 1589: white card, hairline border, radius 16, 18px padding — replaces
  // the old table row (the PRODUCT/PRICE/QUANTITY/TOTAL header is hidden now).
  card: {
    web: 'w-full flex flex-row bg-white border border-hairline rounded-2xl p-[18px] hover:shadow-[0_6px_20px_rgba(20,16,60,0.05)] transition-shadow duration-200',
    mobile:
      'flex flex-row w-full min-h-[110px] gap-[12px] bg-white rounded-2xl p-3 mb-[10px] shadow-[0_2px_10px_rgba(20,16,60,0.04)]',
  },
  boxes: {
    main: {
      web: 'relative w-full flex flex-row items-center gap-[18px]',
      mobile: 'relative h-full w-full flex flex-row items-start',
    },
    detail: {
      web: 'flex flex-col justify-center items-start w-full min-w-0',
      // no fixed width: variant tags carry the full product name, so this column
      // has to wrap to whatever the card leaves it (~208px at 360, ~180 at 320)
      mobile: 'flex flex-col justify-start items-start w-full min-w-0 h-auto',
    },
    img: {
      web: 'flex w-24 h-24 justify-center bg-fill rounded-xl items-center flex-shrink-0 overflow-hidden',
      mobile:
        'flex min-w-[84px] h-[84px] rounded-xl bg-[#F5F5F8] justify-center items-center flex-shrink-0',
    },
  },
  typo: {
    web: 'text-[16px] font-bold leading-[1.35] mt-[2px] mb-[4px] whitespace-normal break-words line-clamp-2 text-ink',
    mobile: 'text-[14px] font-semibold leading-[1.3] text-[#17161D]',
  },
  // Web hides the unit price: the right-hand column (AddToCart, cartAction
  // "delete") owns the money for this line so the qty-aware total is the only
  // number shown, matching the mockup's single 18px navy price.
  typo2: {
    web: 'hidden',
    mobile:
      'font-bold text-[16px] leading-none tracking-normal text-[#20166E] mt-[10px]',
  },
  priceUnit: {
    web: 'hidden',
    mobile: 'text-[10px] font-normal text-[#8B8A98] ml-1',
  },
  typo3: {
    web: 'flex justify-center text-center text-xl font-medium',
    mobile: 'flex justify-center text-center text-lg font-medium',
  },
  // Spec 1589 shows a brand eyebrow; the cart API returns a bare `Product`
  // (no brand relation), so the already-fetched category name fills the slot.
  categoryName: {
    web: 'font-semibold text-[11px] leading-[16px] uppercase tracking-[0.08em] text-muted',
    mobile: 'hidden',
  },
  circProgress: {
    web: 'w-[24px] h-[24px] mt-2',
    mobile: 'w-[24px] h-[24px]',
  },
  cardActions: 'w-full flex justify-center items-end',
  cardMedia: {
    web: 'w-full h-full object-contain p-1',
    mobile: 'h-[70px] w-auto max-w-[84px] object-contain',
  },
  info: {
    web: 'flex flex-1 min-w-0 flex-row items-center justify-between gap-[18px]',
    // column, not flex-wrap: the details used to be pushed onto their own line by
    // a fixed 260px width, which overflowed narrow screens. Stacking is explicit.
    mobile: 'ml-3 h-auto min-w-0 flex-1 flex flex-col justify-start gap-2',
  },
  divider: {
    web: 'hidden',
    mobile: 'hidden',
  },
  det2: {
    web: 'flex flex-col flex-1 min-w-0 m-0 p-0',
    // min-w-0 lets this shrink below its text's min-content width
    mobile: 'flex flex-col min-w-0 w-full',
  },
};
