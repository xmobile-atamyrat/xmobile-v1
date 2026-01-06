export const notificationClasses = {
  badge: {
    container: {
      web: 'relative inline-flex items-center justify-center',
      mobile: 'relative inline-flex items-center justify-center',
    },
    icon: {
      web: 'w-[28px] h-[28px] text-[#303030]',
      mobile: 'w-[30px] h-[30px] text-[#1b1b1b]',
    },
    count: {
      web: 'absolute top-[-4px] right-[-4px] min-w-[18px] h-[18px] bg-[#ff624c] text-white text-[11px] font-semibold rounded-full flex items-center justify-center px-[4px]',
      mobile:
        'absolute top-[-4px] right-[-4px] min-w-[18px] h-[18px] bg-[#ff624c] text-white text-[11px] font-semibold rounded-full flex items-center justify-center px-[4px]',
    },
  },
  menu: {
    paper: {
      web: 'mt-[8px] max-w-[400px] w-[400px] max-h-[600px]',
      mobile: 'mt-[8px] max-w-[90vw] w-[90vw] max-h-[70vh]',
    },
    header: {
      web: 'px-[16px] py-[12px] border-b border-[#e6e6e6] flex items-center justify-between',
      mobile:
        'px-[12px] py-[10px] border-b border-[#e6e6e6] flex items-center justify-between',
    },
    title: {
      web: 'text-[16px] font-semibold text-[#303030]',
      mobile: 'text-[14px] font-semibold text-[#1b1b1b]',
    },
    clearButton: {
      web: 'text-[12px] text-[#ff624c] cursor-pointer hover:underline',
      mobile: 'text-[12px] text-[#ff624c] cursor-pointer',
    },
    list: {
      web: 'max-h-[500px] overflow-y-auto',
      mobile: 'max-h-[50vh] overflow-y-auto',
    },
    empty: {
      web: 'px-[16px] py-[24px] text-center text-[14px] text-[#838383]',
      mobile: 'px-[12px] py-[20px] text-center text-[13px] text-[#838383]',
    },
  },
  item: {
    container: {
      web: 'px-[16px] py-[12px] border-b border-[#f0f0f0] cursor-pointer hover:bg-[#f6f6f6] transition-colors',
      mobile:
        'px-[12px] py-[10px] border-b border-[#f0f0f0] cursor-pointer active:bg-[#f6f6f6]',
    },
    unread: {
      web: 'bg-[#ffe8e5] hover:bg-[#ffe0dc]',
      mobile: 'bg-[#ffe8e5] active:bg-[#ffe0dc]',
    },
    content: {
      web: 'flex flex-col gap-[4px]',
      mobile: 'flex flex-col gap-[4px]',
    },
    title: {
      web: 'text-[14px] font-semibold text-[#303030]',
      mobile: 'text-[13px] font-semibold text-[#1b1b1b]',
    },
    text: {
      web: 'text-[13px] text-[#838383] line-clamp-2',
      mobile: 'text-[12px] text-[#838383] line-clamp-2',
    },
    time: {
      web: 'text-[11px] text-[#838383] mt-[4px]',
      mobile: 'text-[10px] text-[#838383] mt-[2px]',
    },
  },
  permissionBanner: {
    container: {
      web: 'px-[16px] py-[12px] bg-[#fff3cd] border-b border-[#ffc107] flex items-center justify-between',
      mobile:
        'px-[12px] py-[10px] bg-[#fff3cd] border-b border-[#ffc107] flex items-center justify-between',
    },
    text: {
      web: 'text-[13px] text-[#856404]',
      mobile: 'text-[12px] text-[#856404]',
    },
    button: {
      web: 'text-[12px] text-[#ff624c] font-semibold cursor-pointer hover:underline',
      mobile: 'text-[12px] text-[#ff624c] font-semibold cursor-pointer',
    },
  },
};
