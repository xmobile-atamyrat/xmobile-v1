export const cartProductCardClasses = {
  card: {
    web: 'w-[79.16vw] h-[294px] flex flex-row mt-[56px] border border-transparent hover:border-[1px] hover:border-[#30303025] transition-all group',
    mobile: 'w-[88.7vw] gap-[12px]',
  },
  boxes: {
    main: 'relative h-full w-full flex flex-row items-center',
    detail: {
      web: 'flex flex-col justify-start items-start w-[20.83vw] ml-[26px]',
      mobile:
        'flex flex-col justify-start min-h-[40px] mt-[8px] mb-[20px] gap-[4px]',
    },
    img: {
      web: 'flex w-[12.34vw] h-[214px] justify-center border-[1px] border-[#f0f0f0] items-center mx-[36px]',
      mobile:
        'flex w-full h-[241px] border-[1px] border-[#f2f2f2] bg-[#fff] rounded-[8px] justify-center items-center p-0',
    },
  },
  typo: {
    web: 'text-[20px] font-semibold leading-[30px] mt-[16px]',
    mobile: 'text-[14px] font-medium text-[#1b1b1b] my-[2px]',
  },
  typo2: {
    web: 'font-semibold text-[20px] leading-[30px] tracking-normal ml-[10px] my-auto w-[11.45vw]',
    mobile:
      'font-medium text-[14px] leading-none tracking-normal text-[#1b1b1b]',
  },
  typo3: {
    web: 'flex justify-center text-center text-xl font-medium',
    mobile: 'flex justify-center text-center text-lg font-medium',
  },
  circProgress: {
    web: 'w-[30px] h-[30px] mr-[190px]',
    mobile: 'w-[24px] h-[24px]',
  },
  cardActions: 'w-full flex justify-center items-end',
  cardMedia: {
    web: 'h-[160px] w-auto p-0 rounded-[5px] justify-center',
    mobile: 'w-auto h-[65%]',
  },
};
