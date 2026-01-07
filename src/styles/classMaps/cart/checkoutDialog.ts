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
    mobile: 'hidden',
  },
  fieldContainer: {
    web: 'flex flex-col gap-[16px]',
    mobile: 'flex flex-col gap-2',
  },
  label: {
    web: 'font-bold text-[20px] leading-[30px] text-[#303030]',
    mobile: 'font-medium text-[14px] leading-normal text-[#1b1b1b]',
  },
  required: {
    web: 'text-[#ff624c]',
    mobile: 'text-[#ee4d4d]',
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
    mobile: 'hidden',
  },
  totalRow: {
    web: 'flex flex-row items-center justify-between',
    mobile: 'hidden',
  },
  totalLabel: {
    web: 'font-semibold text-[20px] leading-[30px] text-[#303030]',
    mobile: 'hidden',
  },
  totalValue: {
    web: 'font-bold text-[20px] leading-[30px] text-[#303030]',
    mobile: 'hidden',
  },
  orderButton: {
    web: 'bg-[#ff624c] text-white font-bold text-[20px] leading-[30px] rounded-[10px] normal-case',
    mobile:
      'bg-[#1b1b1b] text-white font-medium text-[16px] leading-normal rounded-[12px] h-12 w-full normal-case mt-6',
  },
  backButton: {
    mobile: '',
    web: 'hidden',
  },
};
