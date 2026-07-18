export const homePageClasses = {
  category: {
    web: 'w-full h-full flex flex-col',
    mobile: 'hidden',
  },
  card: {
    web: 'flex flex-wrap gap-[30px] w-full items-start',
    mobile: 'flex flex-wrap gap-4 w-full p-3 justify-center',
  },
  categoriesText: {
    web: 'font-semibold text-[36px] leading-[46px] tracking-normal m-3 mb-[48px]',
    mobile:
      'font-medium text-[20px] leading-[100%] tracking-normal text-center text-[#000]',
  },
  topLayer: 'w-full flex flex-row justify-between items-center my-[36px]',
  newProductsMobileAppbar: {
    web: 'hidden',
    mobile: 'w-full h-full flex flex-col',
  },
  newProductsTitle: {
    mobile:
      'font-bold text-[16px] leading-none tracking-[-0.01em] text-[#17161D]',
    web: 'font-medium text-[24px] mt-[20px] mb-[25px]',
  },
  newProductsBox: {
    mobile: 'grid grid-cols-2 gap-3 w-full',
    web: 'grid grid-cols-4 gap-4 w-full',
  },
  main: {
    web: 'w-full',
    mobile: 'w-full px-5 pt-6',
  },
};
