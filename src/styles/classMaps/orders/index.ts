export const ordersIndexClasses = {
  container: {
    web: 'flex flex-col w-full py-8',
    mobile: 'flex flex-col w-full px-4 py-4',
  },
  title: {
    web: 'text-[30px] font-medium',
    mobile: 'text-[20px] font-medium text-center',
  },
  tabs: {
    web: 'hidden',
    mobile: 'flex gap-2 bg-[#f4f5fd] p-1 rounded-[12px] mb-4',
  },
  tab: {
    web: 'hidden',
    mobile: 'flex-1 px-[10px] py-[11px] rounded-[12px] text-center',
  },
  tabActive: {
    web: 'hidden',
    mobile: 'bg-[#1c1b1b] text-white',
  },
  tabInactive: {
    web: 'hidden',
    mobile: 'text-[#1c1b1b]',
  },
  filters: {
    web: 'mb-6',
    mobile: 'hidden',
  },
  emptyState: {
    web: 'text-center py-12',
    mobile: 'text-center py-8',
  },
  pagination: {
    web: 'mt-6 flex justify-center',
    mobile: 'mt-4 flex justify-center',
  },
};
