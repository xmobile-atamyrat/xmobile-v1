export const cartIndexClasses = {
  box: {
    web: 'w-full h-full flex flex-col mt-[64px]',
    mobile: 'w-full h-full flex flex-col my-[36px]',
  },
  prodCart: 'flex flex-wrap gap-4 w-full ml-[10vw]',
  link: 'flex flex-row justify-center items-center gap-1 py-2 no-underline mx-2',
  iconButton: {
    web: 'text-[#fff] font-bold text-[20px] leading-[30px] tracking-normal m-0',
    mobile: 'text-[#fff] font-medium text-[16px] leading-full tracking-normal',
  },
  breadcrumbs: {
    web: 'ml-[10vw] mb-[32px] flex flex-row mt-[-50px]',
    mobile: 'hidden',
  },
  breadcrumbsText:
    'no-underline text-[#303030] text-[16px] leading-[24px] tracking-normal',
  emptyCart: {
    img: {
      web: 'w-[22.34vw] h-[18.64vw] mx-auto my-[3.9vw]',
      mobile: 'w-[180px] h-[150px] mx-auto mt-[100px]',
    },
    typo: {
      web: 'font-medium text-[30px] leading-[24px] tracking-normal text-[#000] text-center mb-[3.125vw]',
      mobile:
        'mt-[38px] font-medium text-[20px] leading-[28px] tracking-normal text-[#000] text-center mb-[35px]',
    },
    link: {
      web: 'min-w-[11.875vw] h-[3.22vw] bg-[#ff624c] rounded-[10px] py-[16px] px-[40px] gap-[10px] flex justify-center items-center no-underline',
      mobile:
        'w-[88.7vw] h-[11.2vw] max-h-[48px] bg-[#ff624c] rounded-[12px] py-[4px] px-[20px] gap-[16px] flex justify-center items-center no-underline',
    },
  },
  infoCol: {
    web: 'flex flex-row w-[79.16vw] min-w-[850px] h-[88px] rounded-[15px] bg-[#f4f4f4] items-center',
    mobile: 'hidden',
  },
  infoColTypo:
    'font-bold text-[16px] leading-[24px] tracking-normal text-[#303030]',
  yourCartTypo: {
    web: 'font-bold text-[56px] leading-[68px] tracking-normal text-[#303030] mb-[1.3vw]',
    mobile:
      'font-medium text-[20px] leading-full tracking-normal text-[#000] text-center mb-[26px]',
  },
};
