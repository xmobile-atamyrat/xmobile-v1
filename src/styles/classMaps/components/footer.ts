export const footerClasses = {
  boxes: {
    mainWeb: {
      web: 'flex flex-col w-[78.95vw] h-[20%] mt-[80px] mx-auto',
      mobile: 'hidden',
    },
    main2: 'flex w-full h-full flex-row',
    footerStack: {
      web: 'flex flex-col w-[35.5vw]',
      mobile: 'grid grid-cols-1',
    },
    menu: 'flex flex-col pb-6',
    copyright:
      'opacity-75 font-regular text-[14px] leading-[20px] tracking-normal text-[#303030]',
  },
  typography: {
    web: 'font-regular text-[14px] leading-[20px] tracking-normal text-[#303030]',
    mobile: 'text-sm font-normal m-2',
  },
  typoContact: {
    web: 'text-xl font-semibold',
    mobile: 'text-lg font-semibold',
  },
  socialLinks:
    'font-regular text-[16px] leading-[24px] tracking-normal text-[#303030]',
  mainMobile: {
    web: 'hidden',
    mobile:
      'justify-between bg-[#fff] w-full h-[60px] py-[20px] shadow-[0_0_70px_0_#0000001A] flex items-center',
  },
  mainBox: {
    web: 'flex flex-col w-full',
    mobile: 'flex flex-col w-full mt-[100px]',
  },
};
