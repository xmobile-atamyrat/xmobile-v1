export const categoryIdClasses = {
  boxes: {
    header: {
      mobile: 'w-full flex-col px-5 my-6',
      // Web had no header at all before step 54; it now matches the listing
      // page's breadcrumb + title block (XMobile.dc.html:1439-1442).
      web: 'w-full flex flex-col gap-1 mt-1 mb-7',
    },
    main: {
      web: 'w-full h-full flex flex-col pt-[22px] pb-10',
      mobile: 'flex flex-col w-full h-full',
    },
  },
  title: {
    web: 'font-extrabold text-[30px] leading-[38px] tracking-[-0.02em] text-ink',
    mobile:
      'font-bold text-[24px] leading-none tracking-[-0.01em] text-left text-[#17161D]',
  },
  // Real subcategory count — the hub-page analogue of the listing's "N products".
  subtitle: {
    web: 'text-[14px] font-medium text-muted',
    mobile: 'hidden',
  },
};
