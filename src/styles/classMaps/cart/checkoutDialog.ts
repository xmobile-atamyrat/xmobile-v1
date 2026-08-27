export const checkoutDialogClasses = {
  dialogContent: {
    mobile: 'px-6 py-4',
  },
  breadcrumbs: {
    web: 'mb-[14px]',
    mobile: 'hidden',
  },
  sectionTitle: {
    mobile:
      'font-bold text-[12px] leading-normal tracking-[0.06em] uppercase text-[#8B8A98] mb-1',
  },
  fieldContainer: {
    mobile: 'flex flex-col gap-2',
  },
  label: {
    mobile: 'font-medium text-[14px] leading-normal text-[#17161D]',
  },
  required: {
    web: 'text-red',
    mobile: 'text-[#E41E2B]',
  },
  textField: {
    web: 'w-full',
    mobile: 'w-full',
  },
  totalContainer: {
    mobile: 'flex flex-col gap-3 mt-8',
  },
  totalRow: {
    mobile: 'flex flex-row items-center justify-between',
  },
  totalLabel: {
    mobile: 'font-medium text-[14px] leading-normal text-[#8B8A98]',
  },
  totalValue: {
    mobile: 'font-bold text-[20px] leading-normal text-[#20166E]',
  },

  // --- Web checkout (spec 1608-1683). Horizontal padding comes from Layout's
  // px-[2vw] container, so only vertical rhythm lives here. ---
  web: {
    page: 'w-full pt-7 pb-12',
    // Spec 1610's dedicated "Secure checkout" header replaces the whole site
    // header in the mockup; we keep the app's Appbar and render the title row
    // in-page instead, so the header/search/cart badge stay reachable.
    headRow: 'flex flex-row items-baseline gap-3 mb-6',
    title: 'font-[800] text-[28px] leading-tight tracking-[-0.02em] text-ink',
    // Spec 1613: 3-step progress. Real state only — the cart is behind us, this
    // page is the form, /cart/checkout/success is the confirmation.
    stepper: 'flex flex-row items-center justify-center mb-7 flex-wrap gap-y-3',
    stepItem: 'flex flex-row items-center gap-[10px]',
    stepDotDone:
      'w-7 h-7 rounded-full bg-[#1F8A5B] text-white flex items-center justify-center flex-shrink-0',
    stepDotActive:
      'w-7 h-7 rounded-full bg-navy text-white text-[13px] font-bold flex items-center justify-center flex-shrink-0',
    stepDotIdle:
      'w-7 h-7 rounded-full bg-[#F0EFF4] text-muted text-[13px] font-bold flex items-center justify-center flex-shrink-0',
    stepLabel: 'text-[14px] font-semibold text-ink whitespace-nowrap',
    stepLabelIdle: 'text-[14px] font-semibold text-muted whitespace-nowrap',
    stepLabelLink:
      'text-[14px] font-semibold text-ink whitespace-nowrap cursor-pointer hover:text-navy transition-colors duration-200',
    stepLineDone: 'w-[60px] h-[2px] bg-navy mx-[18px]',
    stepLineIdle: 'w-[60px] h-[2px] bg-hairline mx-[18px]',
    // 400px summary column (spec 1617); below lg it drops under the form
    grid: 'grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-7 items-start',
    formCol: 'flex flex-col gap-5 min-w-0',
    card: 'bg-white border border-hairline rounded-[18px] p-6',
    cardHead: 'flex flex-row items-center gap-[10px] mb-[18px]',
    cardIcon: 'w-5 h-5 text-navy flex-shrink-0',
    cardTitle: 'text-[17px] font-bold text-ink',
    fieldGrid: 'grid grid-cols-1 md:grid-cols-2 gap-[14px]',
    fieldWide: 'md:col-span-2',
    fieldLabel: 'text-[12px] font-semibold text-muted mb-[6px]',
    // Spec 1637/1652: selected radio row. Only one real option exists for each
    // of delivery and payment, so it renders selected and inert rather than as
    // a choice the user cannot actually make.
    optionRow:
      'flex flex-row items-center gap-[14px] border-2 border-navy rounded-[14px] p-4 bg-[#F7F6FA]',
    radioOuter:
      'w-[22px] h-[22px] rounded-full border-2 border-navy flex items-center justify-center flex-shrink-0',
    radioInner: 'w-[11px] h-[11px] rounded-full bg-navy',
    optionBody: 'flex flex-col flex-1 min-w-0',
    optionTitle: 'text-[15px] font-semibold text-ink',
    optionSub: 'text-[13px] text-muted mt-[2px]',
    optionRight: 'text-[15px] font-bold text-[#1F8A5B] flex-shrink-0',
    saveRow: 'flex flex-row items-center -ml-2 mt-3',
    saveLabel: 'text-[13px] text-[#4A4959]',
    // Spec 1662: "Your order" summary
    summaryCard: 'bg-white border border-hairline rounded-[18px] p-6 h-fit',
    summaryTitle: 'text-[17px] font-bold text-ink mb-[18px]',
    summaryItems:
      'flex flex-col gap-[14px] pb-[18px] border-b border-[#F0EFF4] max-h-[340px] overflow-y-auto',
    summaryItem: 'flex flex-row items-center gap-3',
    summaryThumb:
      'w-[52px] h-[52px] rounded-[10px] bg-fill overflow-hidden flex-shrink-0 flex items-center justify-center',
    summaryThumbImg: 'w-full h-full object-contain p-1',
    summaryItemBody: 'flex flex-col flex-1 min-w-0',
    summaryItemName: 'text-[14px] font-semibold text-ink line-clamp-2',
    summaryItemQty: 'text-[12px] text-muted mt-[2px]',
    summaryItemPrice: 'text-[14px] font-bold text-ink whitespace-nowrap',
    totals: 'flex flex-col gap-[11px] py-4 border-b border-[#F0EFF4]',
    totalsRow: 'flex flex-row justify-between items-center',
    totalsLabel: 'text-[14px] text-[#4A4959]',
    totalsValue: 'text-[14px] font-semibold text-ink',
    totalsFree: 'text-[14px] font-semibold text-[#1F8A5B]',
    grandRow: 'flex flex-row justify-between items-baseline pt-4 pb-1',
    grandLabel: 'text-[16px] font-bold text-ink',
    grandValue: 'text-[24px] font-[800] text-navy',
    placeOrderBtn:
      'w-full h-[54px] mt-4 rounded-[14px] text-[16px] font-bold normal-case',
  },

  // --- Mobile checkout (mockup-shaped, flat string keys, mobile-only) ---
  mobileWrap: 'flex flex-col gap-6 w-full',
  section: 'flex flex-col gap-2',
  // Stepper (decorative)
  stepper: 'flex flex-col gap-1.5 mb-1',
  stepDotsRow: 'flex flex-row items-center',
  stepDotActive:
    'flex items-center justify-center w-7 h-7 rounded-full bg-[#20166E] text-white text-[12px] font-semibold flex-shrink-0 border-0 p-0 cursor-pointer',
  stepDotInactive:
    'flex items-center justify-center w-7 h-7 rounded-full bg-[#ECECF1] text-[#8B8A98] text-[12px] font-semibold flex-shrink-0 border-0 p-0 cursor-pointer',
  stepLine: 'flex-1 h-[2px] bg-[#ECECF1] mx-1',
  stepLabelsRow: 'flex flex-row justify-between',
  stepLabelActive: 'text-[11px] font-medium text-[#20166E] cursor-pointer',
  stepLabelInactive: 'text-[11px] font-medium text-[#8B8A98] cursor-pointer',
  // Wizard nav bar
  navRow: 'flex flex-row gap-3',
  navBackBtn:
    'h-[54px] px-6 rounded-[15px] font-semibold text-[16px] leading-normal normal-case border border-[#ECECF1]',
  navPrimaryBtn:
    'flex-1 h-[54px] rounded-[15px] font-semibold text-[16px] leading-normal normal-case',
  // Address card (saved state)
  addressCard:
    'flex flex-row items-start justify-between bg-white border border-[#ECECF1] rounded-2xl p-4',
  addressName: 'font-bold text-[15px] leading-normal text-[#17161D]',
  addressLine: 'font-normal text-[13px] leading-[20px] text-[#4A4959] mt-1',
  editCard:
    'flex flex-col gap-4 bg-white border border-[#ECECF1] rounded-2xl p-4',
  saveRow: 'flex flex-row items-center gap-1 -ml-2',
  saveLabel: 'font-normal text-[13px] leading-normal text-[#4A4959]',
  // Info cards (delivery / payment)
  infoCard:
    'flex flex-row items-center gap-3 bg-white border border-[#ECECF1] rounded-2xl p-4',
  infoIconTile:
    'flex items-center justify-center w-10 h-10 rounded-[11px] bg-[#F5F5F8] flex-shrink-0 text-[#20166E]',
  infoGrow: 'flex flex-col flex-1 min-w-0',
  infoTitle: 'font-semibold text-[15px] leading-normal text-[#17161D]',
  infoSub: 'font-normal text-[13px] leading-[18px] text-[#8B8A98] mt-0.5',
  infoRight:
    'font-bold text-[15px] leading-normal text-[#20166E] flex-shrink-0',
};
