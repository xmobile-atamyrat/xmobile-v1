const halfWidthTileBase =
  'w-[calc(50%-5px)] flex flex-row items-center bg-[#f7f7f7] rounded-[16px] px-[12px] py-[12px] gap-[10px] cursor-pointer active:bg-[#efefef] min-h-[72px]';

export const popularCategoriesSectionClasses = {
  section: 'w-full flex flex-col mt-[20px] mb-[4px]',
  sectionTitle:
    'font-semibold text-[17px] leading-[22px] text-[#1c1b1b] mb-[14px]',
  grid: 'w-full flex flex-col gap-[10px]',
  fullWidthCard:
    'w-full flex flex-row items-center bg-[#f7f7f7] rounded-[16px] px-[16px] py-[14px] gap-[14px] cursor-pointer active:bg-[#efefef]',
  fullWidthImageBox:
    'w-[52px] h-[52px] flex items-center justify-center shrink-0',
  fullWidthImage: 'w-[52px] h-[52px] object-contain',
  fullWidthName: 'flex-1 font-medium text-[14px] leading-[18px] text-[#1c1b1b]',
  chevron: 'text-[#b8b8b8] text-[18px] ml-auto shrink-0',
  /** Full-width "More" tile (same row height as fullWidthCard, styled like moreTile) */
  fullWidthMoreCard:
    'w-full flex flex-row items-center bg-[#f7f7f7] rounded-[16px] px-[16px] py-[14px] gap-[14px] cursor-pointer active:bg-[#efefef]',
  halfWidthRow: 'w-full flex flex-row gap-[10px]',
  halfWidthCard: halfWidthTileBase,
  halfWidthImageBox:
    'w-[40px] h-[40px] flex items-center justify-center shrink-0',
  halfWidthImage: 'w-[40px] h-[40px] object-contain',
  halfWidthName:
    'flex-1 font-medium text-[12px] leading-[16px] text-[#1c1b1b] line-clamp-2 overflow-hidden',
  halfWidthChevron: 'text-[#b8b8b8] shrink-0',
  moreTile: halfWidthTileBase,
  moreDotsBox: 'w-[40px] h-[40px] flex items-center justify-center shrink-0',
  moreDotsText: 'text-[#b0b0b0] text-[20px] leading-none tracking-widest',
  moreTileText:
    'flex-1 font-medium text-[12px] leading-[16px] text-[#6b6b6b] line-clamp-2 overflow-hidden',
};
