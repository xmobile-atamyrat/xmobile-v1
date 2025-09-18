export const detailPageClasses = {
  boxes: {
    main: {
      web: 'w-full h-full flex flex-row px-4 gap-4 pb-10 pt-[80px]',
      mobile: 'w-full h-full flex flex-col px-4 gap-4 pb-10 pt-[64px]',
    },
    title: {
      web: 'flex flex-col gap-2 w-[50%]',
      mobile: 'flex flex-col gap-2 w-full',
    },
    typo: 'w-full flex flex-row justify-between items-center pb-4',
    img: 'flex w-full justify-center flex-row',
    price: {
      web: 'flex flex-col w-[50%]',
      mobile: 'flex flex-col w-full',
    },
    video: {
      web: 'flex p-2 w-1/2',
      mobile: 'flex p-2',
    },
  },
  circProgress: {
    web: 'w-[30px] h-[30px]',
    mobile: 'w-[24px] h-[24px]',
  },
  typographs: {
    price: {
      web: 'font-semibold text-xl items-center flex',
      mobile: 'font-semibold text-lg items-center flex',
    },
    font: {
      web: 'text-xl',
      mobile: 'text-base',
    },
    font2: {
      web: 'text-lg',
      mobile: 'text-[15px]',
    },
    prodVideo: {
      web: 'font-semibold text-lg break-words',
      mobile: 'font-semibold text-[15px] break-words',
    },
  },
  link: {
    web: 'px-3 pb-3 flex items-center flex-row',
    mobile: 'px-3 pb-3 flex items-center flex-col',
  },
};
