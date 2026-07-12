export const cartCheckoutClasses = {
  container: {
    web: 'flex flex-row justify-center items-center',
    mobile: 'w-full fixed bottom-0 left-0 right-0 z-10',
  },
  summaryBox: {
    web: 'rounded-[16px] px-[40px] py-[16px] flex flex-row justify-between items-center min-w-[618px]',
    // paddingBottom set inline from mobileBottomNavHeight (constants.ts) — clearance above the fixed bottom nav
    mobile: 'bg-white px-5 pt-3.5 shadow-[0_-6px_20px_rgba(20,16,60,0.05)]',
  },
  subtotalRow: {
    web: 'flex flex-row items-center gap-2',
    mobile: 'flex flex-row justify-between w-full pb-2 items-center',
  },
  subtotalLabel: {
    web: 'font-bold text-[20px] leading-[24px] text-[#17161D]',
    mobile: 'font-medium text-[14px] leading-normal text-[#4A4959]',
  },
  subtotalValue: {
    web: 'font-semibold text-[24px] leading-[30px]',
    mobile: 'font-bold text-[20px] leading-normal text-right',
  },
  checkoutButton: {
    web: 'px-[40px] py-[16px] rounded-[15px] text-transform-none flex items-center justify-center gap-2',
    mobile:
      'w-full h-[54px] rounded-[15px] flex items-center justify-center gap-2 text-transform-none',
  },
  checkoutButtonText: {
    web: 'font-bold text-[18px] leading-[30px]',
    mobile: 'font-semibold text-[16px] leading-normal text-center',
  },
};
