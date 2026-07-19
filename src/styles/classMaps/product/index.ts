export const productIndexPageClasses = {
  boxes: {
    backButton: {
      mobile:
        'flex flex-row items-center h-[30px] px-[24px] justify-between my-[20px] absolute left-2 z-[10]',
      web: 'hidden',
    },
    appbar: {
      mobile: 'flex flex-row items-center gap-2.5 px-4 pt-6 pb-3',
      web: 'hidden',
    },
    category: {
      web: 'flex justify-start',
      mobile: 'flex w-full justify-center pl-8',
    },
    products: {
      web: 'flex flex-col w-full h-full pt-8',
      mobile: 'flex flex-col w-full h-full px-[20px]',
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
  // real results count next to the header title (uses products.length only)
  resultsCount: {
    mobile: 'text-[13px] font-medium text-muted',
    web: 'text-[14px] font-medium text-muted',
  },
  // "no results" empty state — real message only, no fabricated suggestions
  emptyState: {
    wrap: 'flex flex-col items-center justify-center text-center w-full py-16 px-6',
    iconWrap:
      'flex items-center justify-center w-16 h-16 rounded-full bg-fill mb-4',
    title: 'text-[16px] font-bold text-ink',
    subtitle: 'text-[13px] font-medium text-muted mt-1',
  },
};
