// Mobile filter bottom sheet chrome, see xmobile-app-redesign/project/XMobile.dc.html:1899-1919
// FilterSidebar.tsx itself stays MUI-sx styled (Slider/Checkbox/TextField internals
// need CSS-in-JS anyway) — these classes only cover the sheet wrapper built inline
// in index.page.tsx / ProductGridContent.tsx.
export const filterSidebarClasses = {
  dragHandle: 'w-10 h-[5px] rounded-full bg-hairline mx-auto mt-2.5 mb-1',
  header:
    'flex items-center justify-between px-5 py-3 border-b border-hairline',
  title: 'text-[18px] font-bold text-ink',
  closeButton: 'text-muted',
  body: 'flex-1 overflow-auto px-5 py-4',
  footer: 'p-4 pb-6 border-t border-hairline',
  applyButton:
    'w-full h-[52px] rounded-[14px] bg-navy text-white text-[15px] font-semibold normal-case shadow-none hover:bg-[#1A1258] hover:shadow-none',
};
