export const detailPageClasses = {
  boxes: {
    main: {
      web: 'w-full h-full flex flex-row px-4 gap-4 pb-10 overflow-hidden',
      mobile:
        'w-full h-full flex flex-col px-4 justify-center items-center mx-auto mt-[16px]',
    },
    images: {
      web: 'flex flex-col gap-2 w-[41.6vw] h-[41.6vw] border-[2px] border-hairline justify-center items-center',
      mobile: 'relative flex flex-col w-full h-auto -mx-4',
    },
    typo: 'w-full flex flex-row justify-between items-center pb-4',
    img: {
      web: 'flex flex-row w-[41.6vw] h-[41.6vw] justify-center items-center',
      mobile: 'flex w-full justify-center flex-row',
    },
    sideInfo: {
      web: 'flex flex-col ml-[4.5vw]',
      mobile:
        'flex flex-col min-w-[88.78vw] min-h-[11.7vw] p-0 justify-start items-center mt-[16px]',
    },
    video: {
      web: 'flex flex-row h-auto mb-[10px] justify-center items-center',
      mobile: 'flex mt-[30px] mb-[-40px] flex-row justify-center items-center',
    },
    detail: {
      web: 'w-[79vw] h-auto flex flex-col justify-center items-center mb-[90px] m-auto p-0 gap-0',
      mobile:
        'min-w-[88.78vw] h-auto flex p-0 gap-0 justify-start items-start mx-auto mt-[-30px] mb-[100px]',
    },
    detailSide: {
      web: 'w-[30vw] h-auto flex flex-col',
      mobile: 'hidden',
    },
    info: {
      web: 'flex flex-col',
      mobile: 'flex flex-col items-start w-full',
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
      web: 'font-[700] text-[2.9vw] leading-[3.5vw] tracking-0 text-navy',
      mobile:
        'font-bold text-[clamp(13px,_4.2vw,_25px)] flex items-center capitalize text-navy',
    },
    font: {
      web: 'text-[clamp(12px,_1.05vw,_20px)] max-w-[17vw]',
      mobile: 'text-[clamp(2vw,_4vw,_15px)]',
    },
    font2: {
      web: 'text-[clamp(13px,_1.05vw,_20px)] leading-[30px] font-regular tarcking-normal text-[#4A4959]',
      mobile:
        'text-[clamp(2vw,_4vw,_15px)] font-regular leading-[20px] tracking-normal opacity-[40%]',
    },
    desc: {
      web: 'text-[clamp(13px,_1.05vw,_20px)] leading-[30px] font-semibold text-ink ml-[0.05vw]',
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
      'text-ink font-bold text-[23px] leading-[1.2] tracking-[-0.01em] text-left',
  },
  cardMedia: {
    web: 'h-[20.8vw] object-contain cursor-pointer',
    mobile: 'w-full h-full object-contain',
  },
  list: {
    web: 'p-0 mb-[3vw]',
    mobile: 'flex flex-col min-w-[88.78vw] justify-start',
  },
  listItemIcon: {
    web: 'w-[1.1vw] h-[1.1vw] text-navy',
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
    web: 'text-[2.4vw] font-semibold text-ink leading-[30px] tracking-normal my-[4.1vw]',
    mobile: 'hidden',
  },
  divider: {
    web: 'mt-[1.25vw] text-hairline w-[33vw] h-[1px]',
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
    desc: 'text-[clamp(13px,_1.05vw,_20px)] leading-[30px] font-semibold text-ink',
    font2:
      'text-[clamp(13px,_1.05vw,_20px)] leading-[30px] font-regular tarcking-normal text-[#4A4959]',
  },
  dialogImg: {
    web: 'w-[90vw] h-auto',
    mobile: 'w-auto h-[90vw] object-contain',
  },
  // Floating back button over the mobile gallery (sole back affordance on mobile —
  // the mobile Appbar returns null on non-home pages). Web uses the app header instead.
  backButton: {
    web: 'hidden',
    mobile:
      'self-start mt-1 mb-2 w-10 h-10 rounded-full bg-white shadow-[0_2px_10px_rgba(20,16,60,0.10)] flex items-center justify-center active:scale-95 transition-transform',
  },
  backIcon: {
    web: 'hidden',
    mobile: 'w-5 h-5 text-navy',
  },
  gallery: {
    wrapper: {
      web: 'relative w-[41.6vw] flex flex-col justify-center items-center',
      mobile: 'relative w-full',
    },
    mainImage: {
      web: 'w-full flex justify-center items-center',
      mobile:
        'relative w-full aspect-square bg-fill flex justify-center items-center overflow-hidden',
    },
    // mobile gallery overlays (design: dot indicators + "n / total" pill)
    counter:
      'absolute bottom-4 right-4 text-[11px] font-semibold text-white bg-[rgba(15,12,40,0.55)] px-3 py-1 rounded-full',
    dots: 'absolute bottom-4 left-0 right-0 flex justify-center items-center gap-[6px]',
    // inactive dots need contrast against the light #F5F5F8 gallery fill
    dot: 'w-[7px] h-[7px] rounded-full bg-[#C4C3CE] cursor-pointer transition-all',
    dotActive:
      'w-[20px] h-[7px] rounded-full bg-navy cursor-pointer transition-all',
    expandBtn: 'absolute top-2 right-2 z-10 bg-white/70 hover:bg-white',
    thumbnailStrip: {
      web: 'flex flex-row gap-3 mt-10 mb-3 justify-center',
      mobile:
        'flex flex-row gap-3 mt-6 mb-3 justify-center overflow-x-auto px-2 w-full',
    },
    thumbnail: {
      base: 'cursor-pointer border-2 rounded bg-white flex-shrink-0',
      inactive: 'border-transparent',
      active: 'border-navy',
      size: {
        web: 'w-[5vw] h-[5vw]',
        mobile: 'w-[80px] h-[80px]',
      },
    },
  },
};
