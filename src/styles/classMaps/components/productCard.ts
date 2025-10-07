export const productCardClasses = {
  card: {
    web: 'w-[280px] min-h-[427px] border-[1px] rounded-[10px] px-2 py-2 border-[#f0f0f0] hover:border-[#30303040] mx-[8px] my-[15px]',
    mobile: 'w-[42%] min-h-[241px] gap-[8px] mx-[8px] my-[8px]',
  },
  boxes: {
    main: 'relative h-full w-full flex flex-col',
    detail: {
      web: 'flex flex-col justify-start min-h-[60px] mb-[16px]',
      mobile:
        'flex flex-col justify-start min-h-[40px] mt-[8px] mb-[20px] gap-[4px]',
    },
    img: {
      web: 'flex justify-center h-[315px] bg-[#f4f4f4] items-center p-0 mb-[16px]',
      mobile:
        'flex w-full h-[241px] border-[1px] border-[#f2f2f2] bg-[#fff] rounded-[8px] justify-center items-center p-0',
    },
    icons:
      'flex w-[50px] h-[50px] bg-white rounded-full border-[1px] border-[#ff624c] items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-100 mx-[10px]',
    iconsInCart:
      'opacity-100 bg-[#ff624c] text-[#fff] w-[50px] h-[50px] hover:bg-[#ee513b] mx-[10px]',
  },
  typo: {
    web: 'text-[20px] font-[600] leading-[30px]',
    mobile: 'text-[14px] font-medium text-[#1b1b1b] my-[2px]',
  },
  typo2: {
    web: 'font-[600] text-[24px] leading-[30px]',
    mobile:
      'font-medium text-[14px] leading-none tracking-normal text-[#1b1b1b]',
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
    web: 'h-[160px] w-auto p-0 rounded-[5px] justify-center',
    mobile: 'w-auto h-[65%]',
  },
  iconGroup: {
    web: 'flex flex-row h-[50px] w-[190px] justify-center mt-[15px]',
    mobile: 'hidden',
  },
  icons: 'w-[20px] h-[20px] text-[#ff624c] ',
  iconsInCart: 'text-[#fff] w-[20px] h-[20px]',
  favIconMobile: {
    web: 'hidden',
    mobile:
      'gap-[8px] w-[32px] h-[32px] rounded-[16px] bg-[#f5f5f5] justify-center items-center ml-auto mr-[13px] flex',
  },
};
