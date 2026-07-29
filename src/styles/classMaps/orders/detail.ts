export const ordersDetailClasses = {
  container: {
    web: 'flex flex-col w-full py-4',
    mobile: 'flex flex-col w-full min-h-screen bg-[#F5F5F8]',
  },
  header: {
    web: 'flex items-center gap-4 mb-4',
    mobile: 'flex items-center gap-3 bg-white px-4 pt-3 pb-3',
  },
  backButton: {
    web: 'hidden',
    mobile:
      'w-10 h-10 rounded-full bg-[#F5F5F8] flex items-center justify-center flex-none',
  },
  headerTitle: {
    web: 'hidden',
    mobile: 'text-[20px] font-bold leading-tight',
  },
  headerOrderNumber: {
    web: 'hidden',
    mobile: 'text-[12px] text-[#8B8A98] font-mono',
  },
  content: {
    web: 'hidden',
    mobile: 'flex flex-col px-4 pt-4 pb-6 gap-[14px]',
  },
  card: {
    web: 'hidden',
    mobile:
      'bg-white rounded-[16px] p-4 shadow-[0_4px_14px_rgba(20,16,60,0.05)]',
  },
  statusRow: {
    web: 'hidden',
    mobile: 'flex items-center justify-between gap-3',
  },
  statusDate: {
    web: 'hidden',
    mobile: 'text-[12px] text-[#8B8A98]',
  },
  cardLabel: {
    web: 'hidden',
    mobile:
      'text-[12px] font-bold uppercase tracking-[0.06em] text-[#8B8A98] mb-3',
  },
  itemRow: {
    web: 'hidden',
    mobile:
      'flex items-start justify-between gap-3 py-[14px] border-b border-[#F4F3F7] first:pt-0 last:pb-0 last:border-0',
  },
  itemName: {
    web: 'hidden',
    mobile: 'text-[14px] font-semibold text-[#17161D]',
  },
  itemMeta: {
    web: 'hidden',
    mobile: 'flex items-center gap-2 text-[12px] text-[#8B8A98] mt-[2px]',
  },
  itemPrice: {
    web: 'hidden',
    mobile: 'text-[14px] font-bold text-[#20166E] whitespace-nowrap',
  },
  totalRow: {
    web: 'hidden',
    mobile: 'flex items-center justify-between',
  },
  totalLabel: {
    web: 'hidden',
    mobile: 'text-[15px] font-bold text-[#17161D]',
  },
  totalValue: {
    web: 'hidden',
    mobile: 'text-[18px] font-extrabold text-[#20166E]',
  },
  infoRow: {
    web: 'hidden',
    mobile:
      'flex gap-3 py-[14px] border-b border-[#F4F3F7] first:pt-0 last:pb-0 last:border-0',
  },
  infoTitle: {
    web: 'hidden',
    mobile: 'text-[13px] font-bold text-[#17161D] mb-[2px]',
  },
  infoText: {
    web: 'hidden',
    mobile: 'text-[12px] text-[#8B8A98] leading-[1.5]',
  },
  cancelButton: {
    web: 'hidden',
    mobile:
      'h-[50px] w-full rounded-[13px] border-[1.5px] border-[#E41E2B] text-[#E41E2B] font-semibold text-[14px] normal-case',
  },
};
