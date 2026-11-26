export const productCardClasses = {
  card: {
    web: 'w-full rounded-2xl overflow-hidden border border-[#F0EFF4] shadow-[0_6px_20px_rgba(20,16,60,0.05)] hover:shadow-[0_10px_28px_rgba(20,16,60,0.10)] transition-shadow duration-200 bg-white',
    mobile:
      'w-full min-h-[200px] rounded-2xl overflow-hidden shadow-[0_4px_14px_rgba(20,16,60,0.05)] bg-white',
  },
  // Staff-only stale-price warning: a coloured border around the whole card
  // and a pill in the image's top-left corner (the heart sits top-right). A
  // border rather than a ring, so a scrolling row can't clip it.
  staleRing: {
    orange: '!border-2 !border-solid !border-[#F59E0B]',
    red: '!border-2 !border-solid !border-[#E5484D]',
  },
  staleBadge: {
    base: {
      web: 'absolute top-2 left-2 z-[1] flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold leading-none text-white shadow-sm',
      mobile:
        'absolute top-1.5 left-1.5 z-[1] flex items-center gap-0.5 rounded-full px-1.5 py-[3px] text-[10px] font-bold leading-none text-white shadow-sm',
    },
    icon: {
      web: 'text-[15px]',
      mobile: 'text-[12px]',
    },
    orange: 'bg-[#F59E0B]',
    red: 'bg-[#E5484D] motion-safe:animate-pulse',
  },
  boxes: {
    main: 'relative h-full w-full flex flex-col cursor-pointer',
    detail: {
      web: 'flex flex-1 flex-col justify-start px-[14px] pt-3 pb-[14px]',
      mobile: 'flex flex-1 flex-col justify-start px-3 pt-[11px] pb-[13px]',
    },
    img: {
      web: 'relative flex justify-center aspect-[3/2] bg-[#F5F5F8] items-center overflow-hidden',
      mobile:
        'relative flex w-full h-[128px] bg-[#F5F5F8] justify-center items-center overflow-hidden',
    },
  },
  brand: {
    web: 'text-[13px] font-semibold text-[#8B8A98]',
    mobile: 'text-[10px] font-semibold text-[#8B8A98]',
  },
  typo: {
    web: 'text-[18px] font-semibold leading-[1.3] text-[#17161D] mt-[3px] mb-2 line-clamp-2',
    mobile:
      'text-[13px] font-semibold leading-[1.3] text-[#17161D] mt-[2px] mb-[7px] line-clamp-2',
  },
  typo2: {
    // web: mt-auto lives on footerRow, which owns the price + quick-add row
    web: 'font-bold text-[24px] leading-none text-[#20166E] min-w-0 truncate',
    mobile: 'font-bold text-[15px] leading-none text-[#20166E] mt-auto',
  },
  footerRow: 'flex items-center justify-between gap-3 mt-auto pt-1',
  priceUnit: {
    web: 'text-[13px] font-normal text-[#8B8A98] ml-1',
    mobile: 'text-[10px] font-normal text-[#8B8A98] ml-1',
  },
  typo3: {
    web: 'flex justify-center text-center text-xl font-medium',
    mobile: 'flex justify-center text-center text-lg font-medium',
  },
  circProgress: {
    web: 'w-[24px] h-[24px] mt-auto',
    mobile: 'w-[24px] h-[24px] mt-auto',
  },
  cardActions: 'w-full flex justify-center items-end',
  cardMedia: {
    web: 'h-full w-full object-contain',
    mobile: 'h-full w-full object-contain',
  },
};
