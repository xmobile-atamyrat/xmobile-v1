export const footerClasses = {
  boxes: {
    mainWeb: {
      web: 'flex flex-col w-[78.95vw] h-[20%] mt-[80px] mx-auto',
      mobile: 'hidden',
    },
    mainMobile: {
      web: 'hidden',
      mobile:
        'justify-between bg-white w-full h-[64px] px-[18px] pt-[10px] pb-[12px] border-t border-hairline flex items-center',
    },
    main: {
      web: 'flex flex-col w-full',
      // mobile footer is only the fixed nav; its flow content is hidden, so no
      // top margin (that left a white tail below short pages — clearance is
      // applied once in Layout.tsx via mobileBottomNavHeight padding).
      mobile: 'flex flex-col w-full',
    },
    footerMain: 'flex w-full h-full flex-row',
    footerStack: {
      web: 'flex flex-col w-[35.5vw]',
      mobile: 'grid grid-cols-1',
    },
    menu: 'flex flex-col pb-6',
    bottomNavigation: 'w-full flex',
    address: 'flex items-center w-[26vw] mr-[50px]',
    categoryLinks: 'grid grid-cols-2 mt-[24px] gap-y-[12px] gap-x-[35px]',
    rights: 'flex justify-center my-[24px]',
  },
  flexDirections: {
    col: 'flex flex-col',
    row: 'flex flex-row',
  },
  typos: {
    copyright:
      'opacity-75 font-regular text-[14px] leading-[20px] tracking-normal text-[#303030]',
    contact:
      'font-regular text-[14px] leading-[20px] tracking-normal text-[#303030]',
    headers:
      'font-semibold text-[20px] leading-[30px] tracking-normal text-[#303030]',
    categoryNames:
      'font-regular text-[16px] leading-[24px] tracking-normal text-[#303030] cursor-pointer',
  },
  socialLinks:
    'font-regular text-[16px] leading-[24px] tracking-normal text-[#303030]',
  navItem: {
    wrapper: 'flex-1 flex flex-col items-center gap-1',
    active: 'text-navy',
    inactive: 'text-[#B6B5C2]',
    icon: 'w-[24px] h-[24px]',
    labelActive: 'text-[10px] font-semibold text-center',
    labelInactive: 'text-[10px] font-medium text-center',
  },
  imgs: {
    icons: {
      web: 'text-[#221765]',
      mobile: 'w-[24px]',
    },
    logo: 'w-[145px]',
  },
};
