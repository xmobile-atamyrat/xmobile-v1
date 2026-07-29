export const ordersIndexClasses = {
  container: {
    web: 'flex flex-col w-full py-8',
    mobile: 'flex flex-col w-full min-h-screen bg-[#F5F5F8]',
  },
  headerWrap: {
    web: 'hidden',
    mobile: 'bg-white px-4 pt-3 pb-3',
  },
  backButton: {
    web: 'hidden',
    mobile:
      'w-10 h-10 rounded-full bg-[#F5F5F8] flex items-center justify-center flex-none',
  },
  title: {
    web: 'text-[30px] font-medium',
    mobile: 'text-[20px] font-bold',
  },
  tabs: {
    web: 'hidden',
    mobile: 'flex gap-2 mt-3',
  },
  tab: {
    web: 'hidden',
    mobile: 'px-4 py-2 rounded-full text-[13px] font-semibold normal-case',
  },
  tabActive: {
    web: 'hidden',
    mobile: 'bg-[#20166E] text-white',
  },
  tabInactive: {
    web: 'hidden',
    mobile: 'bg-[#F3F2F8] text-[#4A4959]',
  },
  content: {
    web: '',
    mobile: 'px-4 pt-4',
  },
  filters: {
    web: 'mb-6',
    mobile: 'hidden',
  },
  emptyState: {
    web: 'text-center py-12',
    mobile: 'text-center py-16',
  },
  emptyStateText: {
    web: 'text-[#8B8A98]',
    mobile: 'text-[#8B8A98] text-[14px]',
  },
  pagination: {
    web: 'mt-6 flex justify-center',
    mobile: 'mt-4 flex justify-center',
  },
};
