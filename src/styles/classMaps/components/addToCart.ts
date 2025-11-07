export const addToCartClasses = {
  cartIcon: {
    box: 'rounded-full bg-[rgb(25, 118, 210)] hover:bg-blue-700 shadow',
    iButton: 'rounded-full bg-blue-600 hover:bg-blue-700 shadow text-white',
    fSize: {
      web: 'text-[1.5rem]',
      mobile: 'text-[1.1rem]',
    },
  },
  circIcon: {
    box: {
      web: 'flex column-reverse h-full w-[33.5vw] items-center justify-between',
      mobile: 'flex flex-row w-full justify-between',
    },
    fSize: {
      web: 'w-[16px] h-[16px] text-[#303030] items-center',
      mobile: 'w-[14px] h-[14px] text-[#1c1b1b]',
    },
  },
  input: {
    web: 'w-[40px] h-[40px] rounded-full bg-[#f4f4f4] mx-[16px] font-bold text-[16px] leading-[24px] tracking-normal text-[#303030] [&>input]:text-center',
    mobile:
      'w-[40px] h-[24px] [&>input]:text-center text-[16px] font-medium leading-[150%] tracking-[0.5%] text-[#1c1b1b]',
  },
  price: {
    web: 'flex justify-center items-center w-[8vw]',
    mobile: '',
  },
  priceText: {
    web: 'font-semibold text-[20px] leading-[30px] tracking-normal text-[#303030]',
    mobile: 'hidden',
  },
  deleteButton: {
    box: {
      web: 'mx-[2vw] w-[64px] min-w-[30px] h-[64px] min-h-[30px] rounded-full border-[1px] border-[#ff624c] opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-0 top-auto flex justify-center items-center flex-shrink-0',
      mobile: 'w-[24px] h-[24px] color-[#838383]',
    },
    deleteIcon: {
      web: 'w-[25px] h-[25px] text-[#ff624c]',
      mobile: 'w-[24px] h-[24px] text-[#838383]',
    },
  },
  main: {
    web: 'flex',
    mobile: 'w-[60%]',
  },
  quanChange: {
    web: 'flex items-center mr-[4vw]',
    mobile:
      'flex flex-row justify-between p-[4px] border-[1px] rounded-[8px] border-[#f4f5fd] w-[96px] h-[32px] mt-[10px]',
  },
};
