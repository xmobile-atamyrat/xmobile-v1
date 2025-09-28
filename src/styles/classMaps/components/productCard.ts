export const productCardClasses = {
  card: {
    web: 'w-[280px] h-auto border-[1px] rounded-[10px] px-2 py-2 relative border-[#f0f0f0] hover:border-[#30303040]',
    mobile: 'w-[182px] h-[300px] gap-[8px] rounded-[12px] p-0 border-0',
  },
  boxes: {
    main: 'relative h-full w-full flex flex-col justify-between p-1',
    price: 'flex items-end justify-between',
  },
  typo: {
    web: 'text-[20px] mt-[10px] font-[600] leading-[30px]',
    mobile: 'text-[12px] font-[500] mt-[8px]',
  },
  typo2: {
    web: 'font-[600] text-[24px] leading-[30px]',
    mobile: 'font-[600] text-[14px] leading-[100%] tracking-0',
  },
  typo3: {
    web: 'flex justify-center text-center text-xl font-medium',
    mobile: 'flex justify-center text-center text-lg font-medium',
  },
  circProgress: {
    web: 'w-[30px] h-[30px]',
    mobile: 'w-[24px] h-[24px]',
  },
  cardActions: 'w-full flex justify-center items-end',
  cardMedia: {
    web: 'h-[315px] w-auto p-0 mt-[24px] rounded-[5px]',
    mobile:
      'w-full h-[241px] border-[2px] border-[#f2f2f2] rounded-[8px] object-cover',
  },
};
