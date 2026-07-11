export const productIndexPageClasses = {
  boxes: {
    backButton: {
      mobile:
        'flex flex-row items-center h-[30px] px-[24px] justify-between my-[20px] absolute left-2 z-[10]',
      web: 'hidden',
    },
    appbar: {
      mobile:
        'flex flex-row items-center h-[30px] px-[24px] justify-between my-[20px]',
      web: 'hidden',
    },
    category: {
      web: 'flex justify-start',
      mobile: 'flex w-full justify-center pl-8',
    },
    products: {
      web: 'flex flex-col w-full h-full pt-8',
      mobile: 'flex flex-col w-full h-full px-[24px]',
    },
    productsGrid: {
      web: 'grid grid-cols-4 gap-4 w-full',
      mobile: 'grid grid-cols-2 gap-3 w-full',
    },
  },
  categoryName: {
    mobile:
      'font-medium text-[20px] leading-[100%] tracking-normal text-[#000] justify-center',
    web: 'hidden',
  },
};
