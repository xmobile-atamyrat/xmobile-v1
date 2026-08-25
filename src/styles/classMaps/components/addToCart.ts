export const addToCartClasses = {
  cartButton: {
    // Web quick-add sits in the grid card's price row as a compact circle
    // (ProductCard.tsx) — the label is dropped, the icon carries the meaning.
    button: {
      web: 'w-[40px] h-[40px] p-0 rounded-full bg-navy hover:bg-[#1A1258] text-white flex-shrink-0',
      mobile:
        'w-full h-[38px] mt-[8px] rounded-[10px] bg-navy hover:bg-[#1A1258] text-white gap-[6px] normal-case',
    },
    icon: {
      web: 'w-[18px] h-[18px]',
      mobile: 'w-[14px] h-[14px]',
    },
    text: {
      web: 'hidden',
      mobile: 'text-[12px] font-semibold text-white normal-case',
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
    web: 'w-[44px] text-[16px] font-semibold text-ink leading-[24px] tracking-0 [&>input]:text-center',
    mobile: 'hidden',
  },
  // cartAction="detail" — the product page's buy control. On web it is the
  // bottom half of the spec-1528 buy box (stepper row over a full-width CTA);
  // on mobile it stays the fixed sticky bar from step 13.
  detail: {
    box: {
      web: 'w-full',
      mobile: 'w-full fixed bottom-0 left-0 right-0 z-10',
    },
    bg: {
      web: 'flex flex-col w-full gap-[18px]',
      // paddingBottom set inline from mobileBottomNavHeight (constants.ts) — clearance above the fixed bottom nav
      mobile:
        'flex items-center bg-white rounded-t-[24px] px-4 pt-3 shadow-[0px_-6px_20px_0px_rgba(20,16,60,0.06)]',
    },
    // Spec 1532: bordered 42/44/42 × 46px stepper, not a filled pill
    stepper: {
      web: 'flex flex-row items-center w-fit border border-hairline rounded-[12px] overflow-hidden',
      mobile: 'hidden',
    },
    addToCart: {
      web: 'w-full h-[54px] bg-navy gap-[9px] rounded-[14px] items-center justify-center hover:bg-[#1A1258]',
      mobile:
        'w-full bg-navy hover:bg-[#1A1258] text-white h-[clamp(44px,_11.2vw,_52px)] rounded-[15px] px-[10px] gap-[8px]',
    },
    // minus reads muted, plus navy (spec 1532)
    quantityMinus: 'w-4 h-4 text-muted',
    quantityPlus: 'w-4 h-4 text-navy',
    cartIcon: {
      web: 'w-5 h-5 text-white',
      mobile: 'hidden',
    },
    addToCartText: {
      web: 'justify-center font-[700] text-[16px] leading-[24px] tracking-0 text-white normal-case',
      mobile:
        'font-[600] text-[clamp(13px,_3.5vw,_15px)] leading-[100%] tracking-normal text-white',
    },
  },
  iconButton: {
    web: 'w-[42px] h-[46px] rounded-none flex items-center justify-center',
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
