export const cartProductCardClasses = {
  card: {
    web: 'w-[79.16vw] min-w-[850px] h-[13.5vw] flex flex-row mt-[3vw] border border-transparent hover:border-[1px] hover:border-[#30303025] overflow-visible',
    mobile: 'flex flex-row w-[88.7vw] min-h-[110px] gap-[12px]',
  },
  boxes: {
    main: {
      web: 'relative h-full w-full flex flex-row items-center',
      mobile: 'relative h-full w-full flex flex-row items-start',
    },
    detail: {
      web: 'flex flex-col justify-start items-start w-[clamp(200px,_18vw,_18.5vw)] ml-[1.3vw]',
      mobile: 'flex flex-col justify-start items-start w-[260px] h-auto',
    },
    img: {
      web: 'flex w-[12.34vw] h-[11vw] justify-center border-[1px] border-[#f0f0f0] items-center ml-[2.39vw]',
      mobile:
        'flex min-w-[88px] h-[110px] rounded-[12px] border-[1px] border-[#f5f5f5] justify-center items-center',
    },
  },
  typo: {
    web: 'text-[clamp(16px,_1.041vw,_20px)] font-semibold leading-[30px] mt-[16px] whitespace-normal break-words',
    mobile: 'text-[14px] font-medium text-[#1b1b1b]',
  },
  typo2: {
    web: 'font-regular text-[clamp(16px,_1vw,_20px)] leading-[30px] tracking-normal my-auto w-[13vw]',
    mobile:
      'font-medium text-[16px] leading-full tracking-normal text-[#1b1b1b] mt-[5px]',
  },
  typo3: {
    web: 'flex justify-center text-center text-xl font-medium',
    mobile: 'flex justify-center text-center text-lg font-medium',
  },
  categoryName: {
    web: 'font-regular text-[14px] leading-[20px] tracking-normal text-[#303030]',
    mobile: 'hidden',
  },
  circProgress: {
    web: 'w-[30px] h-[30px] mr-[190px]',
    mobile: 'w-[24px] h-[24px]',
  },
  cardActions: 'w-full flex justify-center items-end',
  cardMedia: {
    web: 'h-[7vw] w-auto p-0 rounded-[5px] justify-center',
    mobile: 'h-[70px] w-auto max-w-[88px]',
  },
  info: {
    web: 'flex w-[66vw] h-[294px] items-center',
    mobile:
      'ml-[8vw] h-auto min-w-[280px] flex flex-row flex-wrap justify-between',
  },
  divider: {
    web: 'hidden',
    mobile: 'my-[16px] color-[#afafaf] h-[1px] opacity-30',
  },
  det2: {
    web: 'flex flex-row m-0 p-0',
    mobile: 'flex flex-col',
  },
};
