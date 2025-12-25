export const cartCheckoutClasses = {
  container: {
    web: 'flex flex-row justify-center items-center',
    mobile: 'w-full fixed bottom-0 left-0 right-0 z-10',
  },
  summaryBox: {
    web: 'rounded-[10px] px-[40px] py-[16px] flex flex-row justify-between items-center min-w-[618px]',
    mobile:
      'bg-white rounded-t-[40px] px-6 pt-6 pb-[88px] shadow-[0px_-16px_40px_0px_rgba(0,0,0,0.03)]',
  },
  subtotalRow: {
    web: 'flex flex-row items-center gap-2',
    mobile: 'flex flex-row justify-between w-full pb-2 items-center',
  },
  subtotalLabel: {
    web: 'font-bold text-[20px] leading-[24px] text-[#303030]',
    mobile: 'font-medium text-[14px] leading-normal text-[#1b1b1b]',
  },
  subtotalValue: {
    web: 'font-semibold text-[24px] leading-[30px]',
    mobile: 'font-medium text-[20px] leading-normal text-right',
  },
  checkoutButton: {
    web: 'px-[40px] py-[16px] rounded-[10px] text-transform-none',
    mobile:
      'w-full h-12 rounded-[12px] flex items-center justify-center text-transform-none',
  },
  checkoutButtonText: {
    web: 'font-bold text-[20px] leading-[30px]',
    mobile: 'font-medium text-[16px] leading-normal text-center',
  },
};
