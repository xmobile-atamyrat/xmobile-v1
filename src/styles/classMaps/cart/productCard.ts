export const cartProductCardClasses = {
  card: {
    web: 'w-[95vw] min-w-[850px] h-[13.5vw] flex flex-row mt-[3vw] rounded-2xl border border-transparent hover:border-[#F0EFF4] hover:shadow-[0_4px_14px_rgba(20,16,60,0.05)] overflow-visible transition-shadow duration-200',
    mobile:
      'flex flex-row w-full min-h-[110px] gap-[12px] bg-white rounded-2xl p-3 mb-[10px] shadow-[0_2px_10px_rgba(20,16,60,0.04)]',
  },
  boxes: {
    main: {
      web: 'relative h-full w-full flex flex-row items-center',
      mobile: 'relative h-full w-full flex flex-row items-start',
    },
    detail: {
      web: 'flex flex-col justify-center items-start w-[24vw] ml-[1vw]',
      // no fixed width: variant tags carry the full product name, so this column
      // has to wrap to whatever the card leaves it (~208px at 360, ~180 at 320)
      mobile: 'flex flex-col justify-start items-start w-full min-w-0 h-auto',
    },
    img: {
      web: 'flex w-[14vw] h-[11vw] justify-center border-[1px] border-[#F0EFF4] bg-[#F5F5F8] rounded-2xl items-center ml-[3vw] flex-shrink-0',
      mobile:
        'flex min-w-[84px] h-[84px] rounded-xl bg-[#F5F5F8] justify-center items-center flex-shrink-0',
    },
  },
  typo: {
    web: 'text-[clamp(16px,_1.041vw,_20px)] font-semibold leading-[30px] mt-[16px] whitespace-normal break-words text-[#17161D]',
    mobile: 'text-[14px] font-semibold leading-[1.3] text-[#17161D]',
  },
  typo2: {
    web: 'font-bold text-[clamp(16px,_1vw,_20px)] leading-[30px] tracking-normal my-auto w-[14vw] text-[#20166E]',
    mobile:
      'font-bold text-[16px] leading-none tracking-normal text-[#20166E] mt-[10px]',
  },
  priceUnit: {
    web: 'text-[11px] font-normal text-[#8B8A98] ml-1',
    mobile: 'text-[10px] font-normal text-[#8B8A98] ml-1',
  },
  typo3: {
    web: 'flex justify-center text-center text-xl font-medium',
    mobile: 'flex justify-center text-center text-lg font-medium',
  },
  categoryName: {
    web: 'font-regular text-[14px] leading-[20px] tracking-normal text-[#8B8A98]',
    mobile: 'hidden',
  },
  circProgress: {
    web: 'w-[30px] h-[30px] mr-[190px]',
    mobile: 'w-[24px] h-[24px]',
  },
  cardActions: 'w-full flex justify-center items-end',
  cardMedia: {
    web: 'h-[7vw] max-h-[120px] w-auto p-0 rounded-[5px] justify-center',
    mobile: 'h-[70px] w-auto max-w-[84px] object-contain',
  },
  info: {
    web: 'flex w-full h-[294px] items-center',
    // column, not flex-wrap: the details used to be pushed onto their own line by
    // a fixed 260px width, which overflowed narrow screens. Stacking is explicit.
    mobile: 'ml-3 h-auto min-w-0 flex-1 flex flex-col justify-start gap-2',
  },
  divider: {
    web: 'hidden',
    mobile: 'hidden',
  },
  det2: {
    web: 'flex flex-row m-0 p-0',
    // min-w-0 lets this shrink below its text's min-content width
    mobile: 'flex flex-col min-w-0 w-full',
  },
};
