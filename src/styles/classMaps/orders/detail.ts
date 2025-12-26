export const ordersDetailClasses = {
  container: {
    web: 'flex flex-col w-full px-4 py-4',
    mobile: 'flex flex-col w-full px-[28px] py-4',
  },
  header: {
    web: 'flex items-center gap-4 mb-4',
    mobile: 'flex items-center gap-4 mb-4 relative',
  },
  orderNumber: {
    web: 'text-2xl font-semibold mb-2',
    mobile: 'text-[20px] font-medium text-center flex-1',
  },
  statusIcon: {
    web: 'hidden',
    mobile: 'absolute right-0 p-[5px] rounded-[8px]',
  },
  orderedItemsSection: {
    web: 'hidden',
    mobile:
      'bg-white border-b border-[#f4f5fd] flex items-center justify-between h-[56px] px-[16px] py-[12px] mb-4 cursor-pointer',
  },
  orderedItemsText: {
    web: 'hidden',
    mobile: 'font-medium text-[14px] text-[#1c1b1b] tracking-[0.07px]',
  },
  addressSection: {
    web: 'hidden',
    mobile: 'border-b border-[#f4f5fd] flex flex-col gap-[12px] pb-4 mb-4',
  },
  addressTitle: {
    web: 'hidden',
    mobile: 'font-medium text-[16px] text-[#1c1b1b]',
  },
  addressRow: {
    web: 'hidden',
    mobile:
      'flex items-center justify-between h-[32px] py-[12px] text-[12px] text-[#6f7384]',
  },
  addressLabel: {
    web: 'hidden',
    mobile: 'font-normal',
  },
  addressValue: {
    web: 'hidden',
    mobile: 'font-normal',
  },
  orderInfoSection: {
    web: 'hidden',
    mobile: 'flex flex-col gap-[12px] mb-4',
  },
  orderInfoTitle: {
    web: 'hidden',
    mobile: 'font-medium text-[16px] text-[#1c1b1b]',
  },
  orderInfoRow: {
    web: 'hidden',
    mobile:
      'flex items-center justify-between h-[32px] py-[12px] text-[12px] text-[#6f7384]',
  },
  orderInfoTotal: {
    web: 'hidden',
    mobile: 'flex items-center justify-between py-[8px] text-[#1b1b1b]',
  },
  orderInfoTotalLabel: {
    web: 'hidden',
    mobile: 'font-medium text-[16px]',
  },
  orderInfoTotalValue: {
    web: 'hidden',
    mobile: 'font-medium text-[20px]',
  },
  cancelButton: {
    web: 'hidden',
    mobile:
      'bg-[#dcdde2] text-[#1c1b1b] font-medium text-[16px] h-12 w-full rounded-[12px] normal-case',
  },
};
