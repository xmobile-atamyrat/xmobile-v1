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
  // cartAction="delete" — the cart line's right-hand control. Web stacks it as
  // the mockup's price / stepper / remove column (spec 1589); mobile keeps the
  // single row (stepper + delete) it has shipped with since step 34.
  circIcon: {
    box: {
      web: 'flex flex-col h-full items-end justify-center gap-[10px] flex-shrink-0',
      mobile:
        'flex flex-row w-full h-full items-center justify-between mt-[10px]',
    },
    // minus reads muted, plus navy on web (spec 1589), both navy on mobile
    minus: {
      web: 'w-[15px] h-[15px] text-muted',
      mobile: 'w-[13px] h-[13px] text-navy',
    },
    plus: {
      web: 'w-[15px] h-[15px] text-navy',
      mobile: 'w-[13px] h-[13px] text-navy',
    },
  },
  // 36x38 cells inside the bordered web stepper; mobile keeps MUI's own sizing
  stepperButton: {
    web: 'w-9 h-[38px] rounded-none p-0',
    mobile: '',
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
    web: 'w-[38px] h-[38px] bg-transparent mx-0 font-semibold text-[15px] leading-[24px] tracking-normal text-ink [&>input]:text-center [&>input]:p-0',
    mobile:
      'w-[28px] h-[24px] bg-transparent [&>input]:text-center text-[14px] font-bold leading-[150%] tracking-[0.5%] text-ink',
  },
  price: {
    web: 'flex flex-col items-end',
    mobile: 'hidden',
  },
  priceText: {
    web: 'font-[700] text-[18px] leading-none tracking-normal text-navy whitespace-nowrap',
    mobile: 'hidden',
  },
  // Only rendered above 1 unit — the big number is the line total, this says
  // what one costs so the two can never be mistaken for each other.
  unitText: {
    web: 'text-[12px] leading-none text-muted mt-[5px] whitespace-nowrap',
    mobile: 'hidden',
  },
  deleteButton: {
    box: {
      web: 'flex justify-end items-center',
      mobile:
        'w-[32px] h-[32px] p-0 flex justify-center items-center flex-shrink-0 ml-[8px]',
    },
    deleteIcon: {
      web: 'w-[15px] h-[15px]',
      mobile: 'w-[18px] h-[18px] text-muted',
    },
    iconButton: {
      web: 'flex flex-row items-center gap-[5px] p-0 text-red hover:bg-transparent',
      mobile: 'w-full h-full',
    },
    label: {
      web: 'text-[13px] font-semibold text-red leading-none normal-case',
      mobile: 'hidden',
    },
  },
  main: {
    web: 'flex',
    mobile: '',
  },
  // Spec 1589: bordered 36/38/36 x 38px stepper on web; mobile keeps the pill
  quanChange: {
    web: 'flex items-center border border-hairline rounded-[10px] overflow-hidden w-fit',
    mobile:
      'flex items-center gap-[8px] bg-fill rounded-full px-[10px] py-[5px] w-fit',
  },
};
