export const cartCheckoutClasses = {
  // Web (spec 1596-1601) is the cart page's right-hand summary card; mobile is
  // the sticky bar above the bottom nav it has been since step 34.
  container: {
    web: 'w-full',
    mobile: 'w-full fixed bottom-0 left-0 right-0 z-10',
  },
  summaryBox: {
    web: 'flex flex-col bg-white border border-hairline rounded-[18px] p-6',
    // paddingBottom set inline from mobileBottomNavHeight (constants.ts) — clearance above the fixed bottom nav
    mobile: 'bg-white px-5 pt-3.5 shadow-[0_-6px_20px_rgba(20,16,60,0.05)]',
  },
  // The Total line. On web it sits under the breakdown rows and above the CTA.
  subtotalRow: {
    web: 'flex flex-row justify-between items-baseline pt-4 pb-1',
    mobile: 'flex flex-row justify-between w-full pb-2 items-center',
  },
  subtotalLabel: {
    web: 'font-bold text-[16px] leading-[24px] text-ink',
    mobile: 'font-medium text-[14px] leading-normal text-[#4A4959]',
  },
  subtotalValue: {
    web: 'font-[800] text-[24px] leading-[30px]',
    mobile: 'font-bold text-[20px] leading-normal text-right',
  },
  checkoutButton: {
    web: 'w-full h-[54px] mt-4 rounded-[14px] flex items-center justify-center gap-2 text-transform-none',
    mobile:
      'w-full h-[54px] rounded-[15px] flex items-center justify-center gap-2 text-transform-none',
  },
  checkoutButtonText: {
    web: 'font-bold text-[16px] leading-[24px]',
    mobile: 'font-semibold text-[16px] leading-normal text-center',
  },
  // Web-only card chrome
  web: {
    title: 'font-bold text-[17px] leading-[24px] text-ink mb-[18px]',
    rows: 'flex flex-col gap-3 pb-4 border-b border-[#F0EFF4]',
    row: 'flex flex-row justify-between items-center text-[14px]',
    rowLabel: 'text-[14px] text-[#4A4959]',
    rowValue: 'text-[14px] font-semibold text-ink',
    rowFree: 'text-[14px] font-semibold text-[#1F8A5B]',
    // Replaces the mockup's "Secure SSL checkout" line: COD is the only payment
    // method, so the honest reassurance is the one the app actually offers.
    note: 'flex flex-row items-center justify-center gap-2 text-muted mt-3',
    noteText: 'text-[12px] leading-none text-muted',
    noteIcon: 'w-[14px] h-[14px] flex-shrink-0',
  },
};
