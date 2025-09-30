export const productCardClasses = {
  card: {
    web: 'w-[280px] h-auto border-[1px] rounded-[10px] px-2 py-2 relative border-[#f0f0f0] hover:border-[#30303040] group relative mx-[5px] my-[15px]',
    mobile: 'w-[182px] h-[300px] gap-[8px] rounded-[12px] ml-[5px]',
  },
  boxes: {
    main: 'relative h-full w-full flex flex-col justify-between',
    price: 'flex justify-between',
    img: {
      web: 'flex flex-col justify-center h-[315px] bg-[#f4f4f4] items-center',
      mobile:
        'flex flex-col w-[182px] h-[241px] border-[1px] border-[#f2f2f2] rounded-[8px] justify-center items-center',
    },
    icons:
      'flex w-[50px] h-[50px] bg-white rounded-full border border-[#ff624c] items-center justify-center',
  },
  typo: {
    web: 'text-[20px] mt-[10px] font-[600] leading-[30px]',
    mobile: 'text-[12px] font-[500] mt-[8px] text-[#1b1b1b] ml-[5px]',
  },
  typo2: {
    web: 'font-[600] text-[24px] leading-[30px]',
    mobile:
      'font-[500] text-[14px] leading-[100%] tracking-0 mb-[10px] text-[#1b1b1b] ml-[5px]',
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
    web: 'h-[160px] w-auto p-0 mt-[24px] rounded-[5px] justify-center',
    mobile: 'h-[180px] w-[120px] mt-[10px]',
  },
  iconGroup: {
    web: 'flex flex-row h-[50px] w-[190px] justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200 mt-[15px]',
    mobile: 'hidden',
  },
  icons: 'w-[20px] h-[20px] text-[#ff624c]',
};
