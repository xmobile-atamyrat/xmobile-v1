export const productCardClasses = {
  card: {
    web: 'w-[240px] min-h-[340px] rounded-[12px] overflow-hidden border border-[#ebebeb] hover:shadow-[0_4px_20px_rgba(0,0,0,0.09)] transition-shadow duration-200 mx-[8px] my-[12px]',
    mobile: 'w-[35vw] min-h-[45vw] gap-[8px] mx-[8px] my-[8px]',
  },
  boxes: {
    main: 'relative h-full w-full flex flex-col',
    detail: {
      web: 'flex flex-col justify-start px-3 pt-2 pb-3',
      mobile:
        'flex flex-col justify-start min-h-[40px] mt-[8px] mb-[20px] gap-[4px]',
    },
    img: {
      web: 'relative flex justify-center h-[200px] bg-[#f5f5f5] items-center overflow-hidden',
      mobile:
        'relative flex w-full h-[45vw] border-[1px] border-[#f2f2f2] bg-[#fff] rounded-[8px] justify-center items-center p-0',
    },
  },
  typo: {
    web: 'text-[14px] font-semibold leading-[20px] line-clamp-2 text-[#1a1a1a] mt-2',
    mobile: 'text-[13px] font-medium text-[#1b1b1b] my-[2px] line-clamp-2',
  },
  typo2: {
    web: 'font-bold text-[17px] leading-[22px] mt-1',
    mobile:
      'font-medium text-[14px] leading-none tracking-normal text-[#1b1b1b]',
  },
  typo3: {
    web: 'flex justify-center text-center text-xl font-medium',
    mobile: 'flex justify-center text-center text-lg font-medium',
  },
  circProgress: {
    web: 'w-[24px] h-[24px] mt-1',
    mobile: 'w-[24px] h-[24px]',
  },
  cardActions: 'w-full flex justify-center items-end',
  cardMedia: {
    web: 'h-full w-full object-contain',
    mobile: 'h-full w-full object-contain',
  },
};
