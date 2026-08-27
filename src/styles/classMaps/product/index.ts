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
      web: 'flex flex-col w-full h-full pt-[22px] pb-10',
      mobile: 'flex flex-col w-full h-full px-[20px]',
    },
    // Spec 1444: `grid-template-columns:264px 1fr; gap:28px`. minmax(0,1fr)
    // rather than 1fr so a wide product name can't push the grid past the row.
    // Mobile has no rail (FilterSidebar is web-only here), so it stays a column.
    layout: {
      web: 'grid grid-cols-[264px_minmax(0,1fr)] gap-7 w-full items-start',
      mobile: 'flex flex-col w-full',
    },
    productsGrid: {
      // Same intrinsic sizing as the home grid, but a 195px floor rather than
      // 230px: the filter rail takes a fixed 264px, so the row left for the grid
      // is much narrower than the page width. Measured — anything above 195px
      // drops this page to 3 columns at 1280px (a regression from grid-cols-4)
      // and leaves 266px cards at 1600px.
      web: 'grid grid-cols-[repeat(auto-fill,minmax(min(195px,100%),1fr))] gap-4 w-full',
      mobile: 'grid grid-cols-2 gap-3 w-full',
    },
  },
  // Header block above the two-column row. Mobile keeps the old inline rhythm
  // (pt-5/pb-2) so its layout is unchanged by the web restructure.
  header: {
    web: 'flex flex-col gap-1 mb-6',
    // pt-5/pb-6 reproduces the old inline pt-20px + pb-8px + mb-16px exactly,
    // so moving this block out of the results column doesn't shift mobile.
    mobile: 'flex flex-col gap-0.5 pt-5 pb-6',
  },
  // Spec 1441: 30px/800 h1, -.02em. Mobile still uses homePageClasses.
  pageTitle: {
    web: 'font-extrabold text-[30px] leading-[38px] tracking-[-0.02em] text-ink',
    mobile:
      'font-bold text-[16px] leading-none tracking-[-0.01em] text-[#17161D]',
  },
  categoryName: {
    mobile:
      'font-medium text-[20px] leading-[100%] tracking-normal text-[#000] justify-center',
    web: 'hidden',
  },
  // real results count next to the header title
  resultsCount: {
    mobile: 'text-[13px] font-medium text-muted',
    web: 'text-[14px] font-medium text-muted',
  },
  // Sort bar, spec 1456-1458: tinted rail-width bar holding the active filter
  // chips on the left and the sort trigger on the right. Mobile sorts inside
  // the filter bottom sheet (step 33), so there's no bar there.
  resultsBar: {
    // min-h-16 + mb-5 is the paired half of filterRailClasses.header — keep the
    // two in step or the grid's first card row stops lining up with the rail's
    // first filter section. 38px sort trigger + py-3 + 1px borders = 64px, so
    // min-h-16 is what the content already measures; it just pins the floor.
    web: 'flex items-center justify-between gap-4 flex-wrap bg-[#F7F6FA] border border-hairline rounded-[14px] px-[18px] py-3 min-h-16 mb-5',
    mobile: 'hidden',
  },
  activeFilters: {
    wrap: 'flex items-center gap-2.5 flex-wrap min-w-0',
    label: 'shrink-0 text-[13px] text-muted',
    chip: 'flex items-center gap-1.5 rounded-full border border-hairline bg-white px-3 py-1.5 text-[13px] font-semibold text-ink normal-case min-w-0 hover:bg-fill',
    chipLabel: 'truncate max-w-[160px]',
    chipIcon: 'shrink-0 text-muted',
  },
  // Category facet pills, spec 1707 — search results only. The counts are a
  // real groupBy over the same query (see fetchCategoryFacets), rolled up to
  // root categories; nothing here is fabricated. While these render, the rail's
  // own category section is hidden so one dimension has one control.
  categoryFacets: {
    wrap: 'flex items-center gap-2.5 flex-wrap mb-6',
    // 13px/600, 9px 16px, fully rounded — inactive #F3F2F8 on #4A4959.
    // leading-4 because MUI Button's 1.75 line-height would make these 41px
    // tall; 9+16+9 = 34px is both the mockup's height and the height of the
    // active-filter chip that sits directly above them in the sort bar.
    pill: 'rounded-full bg-[#F3F2F8] px-4 py-[9px] text-[13px] leading-4 font-semibold text-[#4A4959] normal-case min-w-0 hover:bg-[#E9E8EE]',
    pillActive:
      'rounded-full bg-navy px-4 py-[9px] text-[13px] leading-4 font-semibold text-white normal-case min-w-0 hover:bg-[#1A1258]',
    label: 'truncate max-w-[180px]',
    // The mockup runs the count into the label at the same weight; a lighter
    // count just keeps the category name the thing you read first.
    count: 'ml-1.5 shrink-0 opacity-70',
  },
  // Numbered pagination, spec 1473 — 40px squares, navy active, hairline rest.
  pagination: {
    wrap: 'flex items-center justify-center gap-2 mt-8',
    page: 'flex items-center justify-center w-10 h-10 min-w-10 rounded-[10px] border border-hairline text-[14px] font-semibold text-ink normal-case p-0 hover:bg-fill',
    pageActive:
      'flex items-center justify-center w-10 h-10 min-w-10 rounded-[10px] bg-navy text-white text-[14px] font-semibold normal-case p-0 hover:bg-[#1A1258]',
    arrow:
      'flex items-center justify-center w-10 h-10 min-w-10 rounded-[10px] border border-hairline text-navy p-0 hover:bg-fill',
    arrowDisabled:
      'flex items-center justify-center w-10 h-10 min-w-10 rounded-[10px] border border-hairline text-muted p-0 opacity-50 pointer-events-none',
    ellipsis: 'flex items-center justify-center w-10 h-10 text-muted',
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
