// Web mega menu — dim overlay + left rail + subcategory panel, see
// xmobile-app-redesign/project/XMobile.dc.html:2231-2290.
// Web-only by construction (the mobile appbar renders no category menu at all),
// so this map has no platform keys.
export const categoryMegaMenuClasses = {
  // Both are absolutely positioned against the sticky AppBar, so they hang from
  // the bottom of the category bar without needing its pixel height. The AppBar
  // box is already inset by Layout's px-[2vw], so the panel sits at left-0
  // (flush with the logo and the category bar) and the dim bleeds back out.
  overlay:
    'absolute top-full -left-[2vw] -right-[2vw] h-screen bg-[rgba(15,12,30,.32)] z-10',
  panel:
    'absolute top-full left-0 right-0 z-20 flex bg-white rounded-b-[16px] overflow-hidden shadow-[0_30px_60px_rgba(20,16,60,.28)] max-h-[calc(100vh-220px)]',

  rail: 'w-[230px] flex-none bg-[#FAFAFC] border-r border-[#F0EFF4] py-[10px] overflow-y-auto',
  // Row is a div so the admin menu button isn't nested inside the row button.
  railRow:
    'group w-full flex flex-row items-center pr-[14px] border-l-[3px] border-solid border-y-0 border-r-0 transition-colors',
  railRowIdle: 'border-l-transparent text-[#4A4959] hover:bg-white',
  railRowActive: 'border-l-red bg-white text-navy',
  railButton:
    'flex-1 min-w-0 flex flex-row items-center gap-3 pl-[17px] py-[9px] text-left',
  railThumbBox:
    'w-[30px] h-[30px] flex-none rounded-[9px] bg-white border border-hairline overflow-hidden flex items-center justify-center',
  railThumb: 'w-full h-full object-contain p-[3px]',
  railLabel: 'flex-1 min-w-0 truncate text-[14px]',
  railLabelIdle: 'font-medium',
  railLabelActive: 'font-bold',
  railChevron: 'w-4 h-4 flex-none',
  railChevronIdle: 'text-[#C7C6D2]',
  railChevronActive: 'text-navy',
  railAdd:
    'w-full flex flex-row items-center gap-3 px-[20px] py-[9px] mt-[6px] border-t border-hairline text-left text-[14px] font-semibold text-navy hover:bg-white transition-colors',

  content: 'flex-1 min-w-0 flex flex-row gap-7 px-7 py-6 overflow-y-auto',
  groups:
    'flex-1 min-w-0 grid grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-[26px] content-start',
  group: 'min-w-0 flex flex-col items-start',
  groupHeadingRow: 'group flex flex-row items-center gap-1 mb-3 max-w-full',
  groupHeading:
    'text-[12px] font-bold tracking-[.06em] uppercase text-navy text-left truncate hover:underline',
  groupList: 'flex flex-col items-start gap-[9px] max-w-full',
  groupItemRow: 'group flex flex-row items-center gap-1 max-w-full',
  groupItem:
    'text-[13px] text-[#4A4959] text-left truncate hover:text-navy transition-colors',
  // Categories with no subcategories keep the group shape: same heading, one
  // "all products" link in place of the child list.
  emptyHeading:
    'text-[12px] font-bold tracking-[.06em] uppercase text-navy mb-3 truncate max-w-full',
  emptyLink:
    'text-[13px] text-[#4A4959] hover:text-navy transition-colors flex flex-row items-center gap-1.5',

  // Category spotlight (the mockup's product promo, spec :2281-2284). No
  // "featured product" data exists, so it highlights the open category itself.
  promo:
    'w-[210px] flex-none rounded-[16px] overflow-hidden bg-navy text-white flex flex-col self-start',
  promoImage: 'w-full h-[130px] object-contain bg-white/[0.08] p-3',
  promoBody: 'p-4 flex flex-col items-start',
  promoEyebrow:
    'text-[11px] font-bold text-[#FEBC2E] uppercase tracking-[.08em]',
  promoTitle: 'text-[16px] font-bold leading-[1.2] mt-1.5 mb-1 line-clamp-2',
  promoMeta: 'text-[13px] text-white/[0.75] mb-3',
  promoCta:
    'flex flex-row items-center gap-1.5 text-[12px] font-semibold bg-red px-3 py-[7px] rounded-[8px] hover:bg-[#C81926] transition-colors',
  promoCtaIcon: 'w-[13px] h-[13px]',

  // Admin edit/delete, carried over from the old CollapsableBase row menu.
  adminButton:
    'flex-none p-0.5 rounded-[6px] text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-hairline hover:text-navy transition-opacity',
  adminIcon: 'w-4 h-4',
  adminMenuItem:
    'flex flex-row justify-start gap-2 items-center px-3 text-[14px]',
};
