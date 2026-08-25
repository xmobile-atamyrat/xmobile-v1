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
  // Desktop storefront (spec 1268-1391). Horizontal padding comes from
  // Layout's px-[2vw] container, so only vertical rhythm lives here.
  web: {
    page: 'w-full pt-7 pb-10',
    // hero cell drives the row height; the promo column stretches to match it
    heroRow: 'grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-5 mb-9',
    heroRowNoBanner: 'grid grid-cols-1 gap-5 mb-9',
    promoCol: 'flex flex-row xl:flex-col gap-5',
    promoColWide: 'flex flex-row gap-5',
    trustRow: 'grid grid-cols-2 xl:grid-cols-4 gap-4 mb-10',
    trustCard:
      'flex items-center gap-[14px] bg-white border border-hairline rounded-2xl px-5 py-[18px]',
    trustIconBox:
      'w-11 h-11 rounded-xl bg-[#F3F2F8] flex items-center justify-center text-navy shrink-0',
    trustTitle: 'text-[14px] font-semibold text-ink leading-tight',
    trustSub: 'text-[12px] text-muted leading-tight mt-[3px]',
    sectionHead: 'flex items-center justify-between mb-[18px]',
    sectionTitle: 'text-[24px] font-bold tracking-[-0.01em] text-ink',
    viewAll:
      'flex items-center gap-1 text-[14px] font-semibold text-navy cursor-pointer hover:opacity-70 transition-opacity',
    categoryGrid: 'grid grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-[14px]',
    categoryTile:
      'flex flex-col items-center gap-3 text-center border border-hairline rounded-2xl px-3 py-5 cursor-pointer hover:border-navy hover:shadow-[0_6px_20px_rgba(20,16,60,0.06)] transition-all duration-200',
    categoryTileImg: 'w-14 h-14 rounded-2xl object-contain bg-[#F3F2F8] p-1',
    categoryTileName: 'text-[13px] font-semibold text-ink line-clamp-2',
    sectionGap: 'mb-11',
    productGrid: 'grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 w-full',
    emptyText: 'text-[15px] text-muted',
  },
  // Side promo tiles next to the hero banner (spec 1332-1343)
  promoTile: {
    base: 'relative flex-1 min-w-0 min-h-[180px] overflow-hidden rounded-[20px] p-[26px] flex flex-col justify-center cursor-pointer',
    tone: {
      red: 'bg-[#FDECEE]',
      grey: 'bg-[#F3F2F8]',
    },
    image:
      'absolute right-[-10px] bottom-[-10px] w-[150px] h-[150px] object-contain bg-white rounded-[20px] rotate-[-8deg] pointer-events-none select-none',
    content: 'relative',
    eyebrow: {
      red: 'text-[12px] font-bold uppercase tracking-[0.1em] text-red',
      grey: 'text-[12px] font-bold uppercase tracking-[0.1em] text-navy',
    },
    title:
      'text-[22px] font-bold text-ink leading-[1.2] max-w-[170px] mt-[6px] mb-1 line-clamp-2',
    price: 'text-[15px] font-bold text-navy',
    priceUnit: 'text-[13px] font-normal text-muted ml-1',
  },
};
