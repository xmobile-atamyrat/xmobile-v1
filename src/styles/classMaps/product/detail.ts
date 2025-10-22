export const detailPageClasses = {
  boxes: {
    main: {
      web: 'w-full h-full flex flex-row px-4 gap-4 pb-10 pt-[80px]',
      mobile:
        'w-[88.7vw] h-full flex flex-col px-4 gap-4 pb-10 pt-[64px] justify-center items-center mx-auto',
    },
    images: {
      web: 'flex flex-col gap-2 w-[41.6vw] h-[41.6vw] border-[2px] border-[#f0f0f0] justify-center items-center',
      mobile:
        'flex flex-col gap-2 w-full h-[70vw] mx-auto items-center justify-center',
    },
    typo: 'w-full flex flex-row justify-between items-center pb-4',
    img: {
      web: 'flex flex-row w-[41.6vw] h-[41.6vw] justify-center items-center',
      mobile: 'flex w-full justify-center flex-row mx-auto',
    },
    sideInfo: {
      web: 'flex flex-col ml-[88px]',
      mobile:
        'flex flex-row w-full min-h-[11.7vw] p-0 justify-between items-center my-[20px]',
    },
    video: 'flex flex-row w-[5vw] h-auto ml-[1vw]',
    detail: {
      web: 'w-[79vw] h-auto flex flex-col justify-center items-center mb-[90px] m-auto p-0 gap-0',
      mobile:
        'min-w-[88.78vw] h-auto flex p-0 gap-0 justify-center items-start mx-auto mt-[-30px] mb-[30px]',
    },
    detailSide: {
      web: 'w-[35vw] h-auto flex flex-col',
      mobile: 'hidden',
    },
  },
  circProgress: {
    web: 'w-[30px] h-[30px]',
    mobile: 'w-[24px] h-[24px]',
  },
  typographs: {
    price: {
      web: 'font-[700] text-[2.9vw] leading-[3.5vw] tracking-0 text-[#ff624c]',
      mobile: 'font-bold text-[4.2vw] flex items-center capitalize',
    },
    font: {
      web: 'text-[1.05vw]',
      mobile: 'text-base',
    },
    font2: {
      web: 'text-[1.05vw] leading-[30px] font-regular tarcking-normal text-[#303030] opacity-[75%]',
      mobile:
        'text-[clamp(2vw,_3vw,_13px)] font-regular leading-[20px] tracking-normal opacity-[40%]',
    },
    desc: {
      web: 'text-[1.05vw] leading-[30px] font-semibold text-[#303030] ml-[0.05vw]',
      mobile:
        'font-bold text-[clamp(2vw,_3vw,_13px)] leading-[20px] tracking-normal opacity-[40%]',
    },
  },
  link: {
    web: 'flex flex-row',
    mobile: 'px-3 pb-3 flex items-center flex-col',
  },
  productName: {
    web: 'font-[600] text-[1.8vw] tracking-[0] leading-[46px]',
    mobile:
      'text-[#1c1b1b] font-medium text-[clamp(3vw,_4.67vw,_20px)] leading-[25px] tracking-normal gap-[2px]',
  },
  cardMedia: {
    web: 'h-[20.8vw] object-contain',
    mobile: 'h-[70vw] object-contain',
  },
  list: {
    web: 'p-0 mb-[3vw]',
    mobile: 'hidden',
  },
  specs: {
    web: 'text-[2.4vw] font-semibold text-[#303030] leading-[30px] tracking-normal my-[4.1vw]',
    mobile: 'hidden',
  },
  divider: {
    web: 'mt-[1.25vw] text-[#303030] w-[33vw] h-[1px]',
    mobile: 'hidden',
  },
  detail: {
    specs: {
      web: 'grid grid-cols-2 gap-y-[1vw] gap-x-[2vw]',
      mobile: 'flex flex-col w-full h-auto gap-y-[15px] gap-x-[2vw]',
    },
    part: {
      web: 'max-w-[35vw] flex flex-row',
      mobile: 'flex flex-row w-full h-auto gap-[2.3vw]',
    },
    head: {
      web: 'w-[12vw]',
      mobile: 'w-[35vw] h-auto',
    },
    val: {
      web: 'flex flex-col max-w-[23.4vw]',
      mobile: 'max-w-[50vw]',
    },
    name: {
      web: 'flex flex-row w-[40vw]',
      mobile: 'w-[50vw] h-auto',
    },
  },
  detailSide: {
    part: 'w-[35vw] flex flex-row my-[0.4vw]',
    head: 'w-[10vw]',
    val: 'flex flex-col w-[25vw]',
    desc: 'text-[1.05vw] leading-[30px] font-semibold text-[#303030]',
    font2:
      'text-[1.05vw] leading-[30px] font-regular tarcking-normal text-[#303030]',
  },
};
