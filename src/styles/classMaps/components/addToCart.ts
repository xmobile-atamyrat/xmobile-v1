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
      web: 'flex column-reverse h-full w-[33.5vw] items-center justify-between ml-[-1vw]',
      mobile:
        'flex flex-row w-full h-full items-center justify-between mt-[10px]',
    },
    fSize: {
      web: 'w-[16px] h-[16px] text-[#303030] items-center',
      mobile: 'w-[14px] h-[14px] text-[#1c1b1b]',
    },
  },
  input: {
    web: 'w-[clamp(30px,_2vw,_40px)] h-[clamp(30px,_2vw,_40px)] rounded-full bg-[#f4f4f4] mx-[16px] font-bold text-[clamp(12px,_0.8vw,_16px)] leading-[24px] tracking-normal text-[#303030] [&>input]:text-center',
    mobile:
      'w-[40px] h-[24px] [&>input]:text-center text-[16px] font-medium leading-[150%] tracking-[0.5%] text-[#1c1b1b]',
  },
  price: {
    web: 'flex justify-start items-center min-w-[12vw]',
    mobile: 'hidden',
  },
  priceText: {
    web: 'font-[500] text-[clamp(16px,_1vw,_20px)] leading-[30px] tracking-normal text-[#303030] whitespace-nowrap',
    mobile: 'hidden',
  },
  deleteButton: {
    box: {
      web: 'mx-[2vw] w-[clamp(40px,_3.33vw,_64px)] h-[clamp(40px,_3.33vw,_64px)] rounded-full border-[1px] border-[#ff624c] p-0 flex justify-center items-center flex-shrink-0 group/delete',
      mobile: 'w-[40px] h-[40px] color-[#838383] p-0 gap-0 ml-[8px]',
    },
    deleteIcon: {
      web: 'h-[clamp(15px,_1.3vw,_25px)] w-auto brightness-100 group-hover/delete:invert group-hover/delete:brightness-0 transition-all duration-200',
      mobile: 'w-[24px] h-[24px]',
    },
    iconButton: {
      web: 'w-full h-full hover:bg-[#ff624c]',
      mobile: 'w-full h-full',
    },
  },
  main: {
    web: 'flex',
    mobile: '',
  },
  quanChange: {
    web: 'flex items-center mr-[2vw]',
    mobile:
      'flex flex-row justify-between p-[4px] border-[1px] rounded-[8px] border-[#f4f5fd] w-[96px] h-[32px]',
  },
};
