export const addToCartClasses = {
  cartIcon: {
    box: 'rounded-full bg-navy shadow',
    iButton: 'rounded-full bg-navy hover:bg-[#1A1258] text-white',
    fSize: {
      web: 'w-[22px] h-[22px]',
      mobile: 'w-[18px] h-[18px]',
    },
  },
  circIcon: {
    box: {
      web: 'flex flex-row h-full items-center gap-[16px]',
      mobile:
        'flex flex-row w-full h-full items-center justify-between mt-[10px]',
    },
    fSize: {
      web: 'w-[15px] h-[15px] text-navy',
      mobile: 'w-[13px] h-[13px] text-navy',
    },
  },
  input: {
    web: 'text-[1.1vw] font-bold text-ink leading-[32px] tracking-0 w-[2vw] [&>input]:text-center',
    mobile: 'hidden',
  },
  detail: {
    box: {
      web: 'flex flex-row items-center min-w-[28vw] h-[3.5vw] mt-[7.5vw] gap-[1.5vw]',
      mobile: 'w-full fixed bottom-0 left-0 right-0 z-10',
    },
    bg: {
      web: 'flex w-full h-full items-center',
      // paddingBottom set inline from mobileBottomNavHeight (constants.ts) — clearance above the fixed bottom nav
      mobile:
        'flex items-center bg-white rounded-t-[24px] px-4 pt-3 shadow-[0px_-6px_20px_0px_rgba(20,16,60,0.06)]',
    },
    stepper: {
      web: 'flex flex-row items-center gap-[10px] bg-fill rounded-full px-[14px] py-[10px]',
      mobile: 'hidden',
    },
    addToCart: {
      web: 'flex-1 h-[3.5vw] bg-navy gap-[10px] rounded-[15px] py-[16px] px-[2vw] items-center justify-center hover:bg-[#1A1258]',
      mobile:
        'w-full bg-navy hover:bg-[#1A1258] text-white h-[clamp(44px,_11.2vw,_52px)] rounded-[15px] px-[10px] gap-[8px]',
    },
    quantityButton: 'w-[1.1vw] h-[1.1vw] text-navy',
    addToCartText: {
      web: 'justify-center font-[700] text-[1vw] leading-[30px] tracking-0 text-white',
      mobile:
        'font-[600] text-[clamp(13px,_3.5vw,_15px)] leading-[100%] tracking-normal text-white',
    },
  },
  iconButton: {
    web: 'w-[32px] h-[32px] flex items-center justify-center',
    mobile: 'hidden',
  },
  inputDet: {
    web: 'w-[clamp(24px,_1.6vw,_32px)] h-[clamp(24px,_1.6vw,_32px)] bg-transparent mx-0 font-bold text-[clamp(12px,_0.8vw,_16px)] leading-[24px] tracking-normal text-ink [&>input]:text-center',
    mobile:
      'w-[28px] h-[24px] bg-transparent [&>input]:text-center text-[14px] font-bold leading-[150%] tracking-[0.5%] text-ink',
  },
  price: {
    web: 'flex justify-start items-center w-[14vw]',
    mobile: 'hidden',
  },
  priceText: {
    web: 'font-[700] text-[clamp(16px,_1vw,_20px)] leading-[30px] tracking-normal text-navy whitespace-nowrap',
    mobile: 'hidden',
  },
  deleteButton: {
    box: {
      web: 'ml-[8px] w-[32px] h-[32px] p-0 flex justify-center items-center flex-shrink-0',
      mobile:
        'w-[32px] h-[32px] p-0 flex justify-center items-center flex-shrink-0 ml-[8px]',
    },
    deleteIcon: {
      web: 'w-[18px] h-[18px] text-muted hover:text-red transition-colors duration-200',
      mobile: 'w-[18px] h-[18px] text-muted',
    },
    iconButton: {
      web: 'w-full h-full',
      mobile: 'w-full h-full',
    },
  },
  main: {
    web: 'flex',
    mobile: '',
  },
  quanChange: {
    web: 'flex items-center gap-[10px] bg-fill rounded-full px-[14px] py-[8px] w-fit',
    mobile:
      'flex items-center gap-[8px] bg-fill rounded-full px-[10px] py-[5px] w-fit',
  },
};
