export const categoryPageClasses = {
  main: {
    web: 'w-full h-full flex flex-col pt-[22px] pb-10',
    mobile: 'w-full h-full flex flex-col',
  },
  card: {
    web: 'flex flex-wrap gap-[30px] w-full justify-center items-start',
    mobile: 'grid grid-cols-2 gap-3 w-full px-5 pb-6',
  },
  header: {
    web: 'w-full flex flex-col mb-7',
    mobile: 'w-full flex-col px-[24px] my-[36px]',
  },
  categoriesText: {
    // Matches the listing/hub title (XMobile.dc.html:1441) instead of the old
    // 36px semibold heading.
    web: 'font-extrabold text-[30px] leading-[38px] tracking-[-0.02em] text-ink',
    mobile:
      'font-bold text-[24px] leading-none tracking-[-0.01em] text-left text-[#17161D]',
  },
};
