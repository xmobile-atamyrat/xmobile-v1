// Mobile filter bottom sheet chrome, see xmobile-app-redesign/project/XMobile.dc.html:1899-1919
// FilterSidebar.tsx itself stays MUI-sx styled (Slider/Checkbox/TextField internals
// need CSS-in-JS anyway) — these classes only cover the sheet wrapper built inline
// in index.page.tsx / ProductGridContent.tsx.
export const filterSidebarClasses = {
  dragHandle: 'w-10 h-[5px] rounded-full bg-[#E4E3EB] mx-auto mt-2.5 mb-3.5',
  header: 'flex items-center justify-between px-[22px] pb-1',
  title: 'text-[19px] font-bold text-ink',
  resetButton: 'text-[13px] font-semibold text-red cursor-pointer normal-case',
  body: 'flex-1 overflow-auto px-[22px] py-4',
  footer: 'flex gap-3 px-[22px] pt-3.5 pb-8 border-t border-[#F0EFF4]',
  clearButton:
    'flex-1 h-[52px] rounded-[14px] border-[1.5px] border-[#E4E3EB] bg-white text-navy text-[15px] font-semibold normal-case shadow-none hover:bg-fill hover:shadow-none',
  applyButton:
    'flex-[2] h-[52px] rounded-[14px] bg-navy text-white text-[15px] font-semibold normal-case shadow-none hover:bg-[#1A1258] hover:shadow-none',
};
