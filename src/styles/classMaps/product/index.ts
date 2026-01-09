export const productIndexPageClasses = {
  boxes: {
    appbar: {
      mobile:
        'flex flex-row items-center w-full h-[30px] px-[24px] justify-between my-[20px]',
      web: 'hidden',
    },
    category: {
      web: 'flex justify-start',
      mobile: 'flex w-full justify-center',
    },
    products: {
      web: 'flex flex-col w-full h-full',
      mobile: 'flex flex-col w-full h-full px-[24px]',
    },
  },
  categoryName: {
    mobile:
      'font-medium text-[20px] leading-[100%] tracking-normal text-[#000] justify-center',
    web: 'hidden',
  },
};
