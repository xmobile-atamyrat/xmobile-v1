export const cartIndexClasses = {
  box: {
    web: 'w-full h-full flex flex-col mt-[64px]',
    mobile: 'w-full flex flex-col grow bg-fill pt-[36px]',
  },
  cartHeader: {
    web: 'flex flex-row w-full justify-between items-center',
    mobile: 'flex w-full justify-between items-center mb-[20px]',
  },
  prodCart: {
    web: 'flex flex-wrap gap-4 w-full pb-[5vw]',
    mobile: 'flex flex-col grow w-full px-4 pt-[8px] pb-[70px]',
  },
  link: 'flex flex-row justify-center items-center gap-1 py-2 no-underline mx-2',
  iconButton: {
    web: 'text-[#fff] font-bold text-[20px] leading-[30px] tracking-normal m-0',
    mobile: 'text-[#fff] font-medium text-[16px] leading-full tracking-normal',
  },
  breadcrumbs: {
    web: 'mb-[32px] flex flex-row mt-[-50px]',
    mobile: 'hidden',
  },
  breadcrumbsText:
    'no-underline text-[#303030] text-[16px] leading-[24px] tracking-normal',
  emptyCart: {
    img: {
      web: 'w-[22.34vw] h-[18.64vw] mx-auto my-[3.9vw]',
      mobile: 'w-[180px] h-[150px] mx-auto',
    },
    typo: {
      web: 'font-medium text-[30px] leading-[24px] tracking-normal text-[#000] text-center mb-[3.125vw]',
      mobile:
        'mt-[38px] font-medium text-[20px] leading-[28px] tracking-normal text-[#000] text-center mb-[35px]',
    },
    link: {
      web: 'min-w-[11.875vw] h-[3.22vw] bg-[#20166E] rounded-[10px] py-[16px] px-[40px] gap-[10px] flex justify-center items-center no-underline',
      mobile:
        'w-[88.7vw] h-[11.2vw] max-h-[48px] bg-[#20166E] rounded-[12px] py-[4px] px-[20px] gap-[16px] flex justify-center items-center no-underline',
    },
  },
  infoRow: {
    web: 'flex flex-row w-[95vw] h-[88px] rounded-[15px] bg-[#f4f4f4] items-center',
    mobile: 'hidden',
  },
  infoRowTypo:
    'font-bold text-[16px] leading-[24px] tracking-normal text-[#303030]',
  yourCartTypo: {
    web: 'item-center font-bold text-[30px] leading-[68px] tracking-normal text-[#303030] text-center',
    mobile:
      'font-bold text-[24px] leading-tight tracking-[-0.01em] text-[#17161D] text-left',
  },
  cartCount: 'text-muted font-medium',
  cartClearBtn: 'text-[13px] font-semibold text-red cursor-pointer normal-case',
};
