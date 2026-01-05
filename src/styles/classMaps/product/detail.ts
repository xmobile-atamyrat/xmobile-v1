export const detailPageClasses = {
  boxes: {
    main: {
      web: 'w-full h-full flex flex-row px-4 gap-4 pb-10 overflow-hidden',
      mobile:
        'w-full h-full flex flex-col px-4 gap-4 pb-10 justify-center items-center mx-auto',
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
      web: 'flex flex-col ml-[4.5vw]',
      mobile:
        'flex flex-col min-w-[88.78vw] min-h-[11.7vw] p-0 justify-start items-center my-[20px]',
    },
    video: {
      web: 'flex flex-row h-auto mb-[10px] justify-center items-center',
      mobile: 'flex mt-[30px] mb-[-40px] flex-row justify-center items-center',
    },
    detail: {
      web: 'w-[79vw] h-auto flex flex-col justify-center items-center mb-[90px] m-auto p-0 gap-0',
      mobile:
        'min-w-[88.78vw] h-auto flex p-0 gap-0 justify-start items-start mx-auto mt-[-30px] mb-[30px]',
    },
    detailSide: {
      web: 'w-[30vw] h-auto flex flex-col',
      mobile: 'hidden',
    },
    info: {
      web: 'flex flex-col',
      mobile: 'flex flex-row justify-between items-center w-full',
    },
    tag: {
      web: 'flex flex-row gap-[0.5vw] w-[25vw]',
      mobile: 'flex flex-row gap-2 justify-between',
    },
  },
  circProgress: {
    web: 'w-[30px] h-[30px]',
    mobile: 'w-[24px] h-[24px]',
  },
  price: {
    web: 'w-[24.3vw] h-auto my-4 flex',
    mobile: 'h-auto my-4 flex',
  },
  typographs: {
    price: {
      web: 'font-[700] text-[2.9vw] leading-[3.5vw] tracking-0 text-[#ff624c]',
      mobile:
        'font-bold text-[clamp(13px,_4.2vw,_25px)] flex items-center capitalize',
    },
    font: {
      web: 'text-[clamp(12px,_1.05vw,_20px)] max-w-[17vw]',
      mobile: 'text-[clamp(2vw,_4vw,_15px)]',
    },
    font2: {
      web: 'text-[clamp(13px,_1.05vw,_20px)] leading-[30px] font-regular tarcking-normal text-[#303030] opacity-[75%]',
      mobile:
        'text-[clamp(2vw,_4vw,_15px)] font-regular leading-[20px] tracking-normal opacity-[40%]',
    },
    desc: {
      web: 'text-[clamp(13px,_1.05vw,_20px)] leading-[30px] font-semibold text-[#303030] ml-[0.05vw]',
      mobile:
        'font-bold text-[clamp(2vw,_4vw,_15px)] leading-[20px] tracking-normal opacity-[40%]',
    },
  },
  link: {
    web: 'flex flex-row no-underline text-[#000]',
    mobile: 'px-3 pb-3 flex items-center flex-col',
  },
  productName: {
    web: 'font-[600] text-[1.8vw] tracking-normal leading-[46px]',
    mobile:
      'text-[#1c1b1b] font-medium text-[clamp(3vw,_4.67vw,_20px)] leading-[25px] tracking-normal gap-[2px] text-left',
  },
  cardMedia: {
    web: 'h-[20.8vw] object-contain cursor-pointer',
    mobile: 'h-[60vw] object-contain',
  },
  list: {
    web: 'p-0 mb-[3vw]',
    mobile: 'flex flex-col min-w-[88.78vw] justify-start',
  },
  listItemIcon: {
    web: 'w-[1.1vw] h-[1.1vw] text-[#ff624c]',
    mobile: 'w-[7px] h-[7px] mr-[5px]',
  },
  listItemBox: {
    web: 'flex flex-row gap-4',
    mobile: '',
  },
  listItemText: {
    web: 'pl-1',
    mobile: '',
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
      web: 'max-w-[35vw] flex flex-row space-x-5',
      mobile: 'flex flex-row w-full h-auto gap-[2.3vw]',
    },
    head: {
      web: 'flex w-[15vw]',
      mobile: 'w-[25vw] h-auto break-words',
    },
    val: {
      web: 'flex flex-col max-w-[18.4vw]',
      mobile: 'min-w-[30vw] max-w-[60vw] ml-[1vw]',
    },
    name: {
      web: 'flex flex-row w-[30vw]',
      mobile: 'w-[50vw] h-auto justify-start gap-[2.3vw]',
    },
  },
  detailSide: {
    part: 'w-[30vw] flex flex-row my-[0.4vw]',
    head: 'w-[10vw]',
    val: 'flex flex-col w-[18vw]',
    desc: 'text-[clamp(13px,_1.05vw,_20px)] leading-[30px] font-semibold text-[#303030]',
    font2:
      'text-[clamp(13px,_1.05vw,_20px)] leading-[30px] font-regular tarcking-normal text-[#303030]',
  },
  dialogImg: {
    web: 'w-[90vw] h-auto',
    mobile: 'w-auto h-[90vw] object-contain',
  },
};
