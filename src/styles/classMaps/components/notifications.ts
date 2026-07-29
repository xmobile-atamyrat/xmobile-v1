export const notificationClasses = {
  badge: {
    container: {
      web: 'relative inline-flex items-center justify-center',
      mobile: 'relative inline-flex items-center justify-center',
    },
    icon: {
      web: 'w-[20px] h-[20px] text-[#20166E]',
      mobile: 'w-[20px] h-[20px] text-[#20166E]',
    },
    count: {
      web: 'absolute top-[-4px] right-[-4px] min-w-[18px] h-[18px] bg-[#E41E2B] text-white text-[11px] font-bold rounded-full flex items-center justify-center px-[4px]',
      mobile:
        'absolute top-[-4px] right-[-4px] min-w-[18px] h-[18px] bg-[#E41E2B] text-white text-[11px] font-bold rounded-full flex items-center justify-center px-[4px]',
    },
  },
  menu: {
    paper: {
      web: 'mt-[8px] max-w-[400px] w-[400px] max-h-[600px] rounded-[16px] !bg-[#F5F5F8]',
      mobile:
        'mt-[8px] max-w-[90vw] w-[90vw] max-h-[70vh] rounded-[16px] !bg-[#F5F5F8]',
    },
    header: {
      web: 'px-[16px] py-[12px] bg-white flex items-center justify-between',
      mobile: 'px-[12px] py-[10px] bg-white flex items-center justify-between',
    },
    title: {
      web: 'text-[16px] font-bold text-[#17161D]',
      mobile: 'text-[14px] font-bold text-[#17161D]',
    },
    clearButton: {
      web: 'text-[12px] text-[#20166E] font-semibold cursor-pointer hover:underline',
      mobile: 'text-[12px] text-[#20166E] font-semibold cursor-pointer',
    },
    list: {
      web: 'max-h-[500px] overflow-y-auto p-[10px] flex flex-col gap-[10px]',
      mobile: 'max-h-[50vh] overflow-y-auto p-[8px] flex flex-col gap-[8px]',
    },
    empty: {
      web: 'px-[16px] py-[24px] text-center text-[14px] text-[#8B8A98]',
      mobile: 'px-[12px] py-[20px] text-center text-[13px] text-[#8B8A98]',
    },
  },
  sheet: {
    paper: '!bg-[#F5F5F8] !m-0 flex flex-col',
    header:
      'flex-none flex items-center justify-between px-[20px] pt-[12px] pb-[14px] bg-white',
    backButton:
      'w-[40px] h-[40px] rounded-full bg-[#F5F5F8] flex items-center justify-center text-[#20166E] flex-none',
    title: 'text-[20px] font-bold text-[#17161D]',
    list: 'flex-1 overflow-y-auto px-[16px] pt-[10px] pb-[24px] flex flex-col gap-[10px]',
  },
  group: {
    card: {
      web: 'relative bg-white rounded-[14px] px-[14px] py-[14px]',
      mobile: 'relative bg-white rounded-[14px] px-[12px] py-[12px]',
    },
    headerRow: 'relative flex gap-[12px] items-start cursor-pointer',
    count: 'text-[11px] font-semibold text-[#20166E]',
    chevron:
      'flex-none self-center text-[#8B8A98] transition-transform duration-200',
    subList: 'flex flex-col gap-[6px] mt-[10px] pl-[52px]',
    subItem:
      'flex flex-col rounded-[10px] bg-[#F5F5F8] px-[11px] py-[7px] cursor-pointer active:opacity-70',
    subText: 'text-[12px] text-[#4A4959] leading-[1.4] line-clamp-2',
    subTime: 'text-[10px] text-[#B6B5C2] mt-[2px]',
  },
  item: {
    container: {
      web: 'relative flex gap-[12px] px-[14px] py-[14px] rounded-[14px] bg-white cursor-pointer hover:bg-[#FAFAFC] transition-colors',
      mobile:
        'relative flex gap-[10px] px-[12px] py-[12px] rounded-[14px] bg-white cursor-pointer active:bg-[#FAFAFC]',
    },
    unread: {
      web: '',
      mobile: '',
    },
    icon: {
      order: 'bg-[#EDEBF7] text-[#20166E]',
      chat: 'bg-[#F0EEF9] text-[#20166E]',
    },
    content: {
      web: 'flex flex-col gap-[2px] flex-1',
      mobile: 'flex flex-col gap-[2px] flex-1',
    },
    title: {
      web: 'text-[14px] font-semibold text-[#17161D]',
      mobile: 'text-[13px] font-semibold text-[#17161D]',
    },
    text: {
      web: 'text-[13px] text-[#8B8A98] line-clamp-2 leading-[1.45]',
      mobile: 'text-[12px] text-[#8B8A98] line-clamp-2 leading-[1.45]',
    },
    time: {
      web: 'text-[11px] text-[#B6B5C2] mt-[4px]',
      mobile: 'text-[10px] text-[#B6B5C2] mt-[2px]',
    },
  },
};
