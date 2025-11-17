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
    web: 'text-[1.8vw] font-[600] text-[#303030] leading-[46px] tracking-0 [&>input]:text-center',
    mobile: 'hidden',
  },
  detail: {
    box: {
      web: 'flex flex-row min-w-[30.78vw] h-[3.5vw] mt-[7.5vw]',
      mobile: 'flex w-[88.7vw] mx-auto mb-[30px]',
    },
    addToCart: {
      web: 'max-w-[300px] h-[3.5vw] bg-[#ff624c] gap-[10px] rounded-[10px] py-[16px] px-[40px] ml-[5.41vw] items-center hover:bg-[#ec4d38]',
      mobile:
        'w-[88.7vw] bg-[#1C1B1B] text-[#fff] h-[clamp(20px,_11.2vw,_52px)] rounded-[15px] px-[10px] gap-[8px] mx-auto',
    },
    quantityButton: 'w-[24px] h-[24px] rounded-[100%] bg-[#f4f4f4] text-[#000]',
    addToCartText: {
      web: 'justify-center font-[700] text-[1vw] leading-[30px] tracking-0 text-[#fff]',
      mobile:
        'font-[500] text-[clamp(2vw,_3.5vw,_16px)] leading-[100%] tracking-normal',
    },
  },
  iconButton: {
    web: 'w-[2.9vw] h-[2.9vw] bg-[#f4f4f4]',
    mobile: 'hidden',
  },
  inputDet: {
    web: 'w-[40px] h-[40px] rounded-full bg-[#f4f4f4] mx-[16px] font-bold text-[16px] leading-[24px] tracking-normal text-[#303030] [&>input]:text-center',
    mobile:
      'w-[40px] h-[24px] [&>input]:text-center text-[16px] font-medium leading-[150%] tracking-[0.5%] text-[#1c1b1b]',
  },
  price: {
    web: 'flex justify-start items-center min-w-[12vw]',
    mobile: 'hidden',
  },
  priceText: {
    web: 'font-semibold text-[20px] leading-[30px] tracking-normal text-[#303030] whitespace-nowrap',
    mobile: 'hidden',
  },
  deleteButton: {
    box: {
      web: 'mx-[2vw] w-[64px] h-[64px] rounded-full border-[1px] border-[#ff624c] p-0 flex justify-center items-center flex-shrink-0 group/delete',
      mobile: 'w-[40px] h-[40px] color-[#838383] p-0 gap-0 ml-[8px]',
    },
    deleteIcon: {
      web: 'h-[25px] w-auto brightness-100 group-hover/delete:invert group-hover/delete:brightness-0 transition-all duration-200',
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
