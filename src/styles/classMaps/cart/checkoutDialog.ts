export const checkoutDialogClasses = {
  dialog: {
    web: 'rounded-[25px]',
    mobile: 'rounded-[40px]',
  },
  dialogContent: {
    web: 'py-[60px]',
    mobile: 'px-6 py-4',
  },
  breadcrumbs: {
    web: 'mb-[24px]',
    mobile: 'hidden',
  },
  title: {
    web: 'font-bold text-[36px] leading-[68px] text-center mb-[24px]',
    mobile: 'font-medium text-[20px] leading-normal text-center',
  },
  steps: {
    web: 'flex flex-row gap-8 justify-center mb-[50px]',
    mobile: 'hidden',
  },
  step: {
    active: 'font-semibold text-[24px] leading-[30px] text-[#303030]',
    inactive:
      'font-semibold text-[24px] leading-[30px] text-[#303030] opacity-25',
  },
  formContainer: {
    web: 'flex flex-row gap-[30px] max-h-[1000px]',
    mobile: 'flex flex-col',
  },
  customerDetails: {
    web: 'flex flex-col gap-[42px] flex-1',
    mobile: 'flex flex-col gap-6 w-full',
  },
  sectionTitle: {
    web: 'font-semibold text-[28px] leading-[46px] text-[#303030]',
    mobile:
      'font-bold text-[12px] leading-normal tracking-[0.06em] uppercase text-[#8B8A98] mb-1',
  },
  fieldContainer: {
    web: 'flex flex-col gap-[16px]',
    mobile: 'flex flex-col gap-2',
  },
  label: {
    web: 'font-bold text-[20px] leading-[30px] text-[#303030]',
    mobile: 'font-medium text-[14px] leading-normal text-[#17161D]',
  },
  required: {
    web: 'text-[#ff624c]',
    mobile: 'text-[#E41E2B]',
  },
  textField: {
    web: 'w-full',
    mobile: 'w-full',
  },
  orderSummary: {
    web: 'bg-[#f4f4f4] rounded-[25px] p-[46px] w-1/2 flex flex-col justify-between',
    mobile: 'hidden',
  },
  orderSummaryTitle: {
    web: 'font-semibold text-[24px] leading-[30px] text-[#303030]',
    mobile: 'hidden',
  },
  orderItem: {
    web: 'flex flex-row items-center justify-between text-[20px] leading-[30px]',
    mobile: 'hidden',
  },
  orderItemName: {
    web: 'font-normal text-[#303030] w-[65%] flex justify-start',
    mobile: 'hidden',
  },
  orderItemQuantity: {
    web: 'font-bold text-[#303030] mx-4 w-[5%]',
    mobile: 'hidden',
  },
  orderItemPrice: {
    web: 'font-semibold text-[#303030] w-[30%] flex justify-end',
    mobile: 'hidden',
  },
  divider: {
    web: 'bg-[#303030] opacity-25 h-px',
    mobile: 'hidden',
  },
  deliveryFee: {
    web: 'flex flex-row items-center justify-between text-[20px] leading-[30px]',
    mobile: 'hidden',
  },
  deliveryFeeLabel: {
    web: 'font-normal text-[#303030]',
    mobile: 'hidden',
  },
  deliveryFeeValue: {
    web: 'font-bold text-[#303030]',
    mobile: 'hidden',
  },
  totalContainer: {
    web: 'bg-white rounded-[10px] p-6 flex flex-col gap-6',
    mobile: 'flex flex-col gap-3 mt-8',
  },
  totalRow: {
    web: 'flex flex-row items-center justify-between',
    mobile: 'flex flex-row items-center justify-between',
  },
  totalLabel: {
    web: 'font-semibold text-[20px] leading-[30px] text-[#303030]',
    mobile: 'font-medium text-[14px] leading-normal text-[#8B8A98]',
  },
  totalValue: {
    web: 'font-bold text-[20px] leading-[30px] text-[#303030]',
    mobile: 'font-bold text-[20px] leading-normal text-[#20166E]',
  },
  orderButton: {
    web: 'bg-[#ff624c] text-white font-bold text-[20px] leading-[30px] rounded-[10px] normal-case',
    mobile:
      'bg-[#E41E2B] text-white font-semibold text-[16px] leading-normal rounded-[15px] h-[54px] w-full normal-case',
  },
  backButton: {
    mobile: '',
    web: 'hidden',
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
