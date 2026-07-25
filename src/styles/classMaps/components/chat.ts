export const chatClasses = {
  // Widget container
  widget: {
    fab: {
      web: 'fixed bottom-[24px] right-[24px] z-[1000]',
      mobile: 'fixed bottom-[80px] right-[16px] z-[1000]',
    },
    paper: {
      web: 'fixed bottom-[80px] right-[24px] w-[420px] h-[600px]',
      mobile: 'fixed inset-0 w-full h-full',
    },
  },

  // Header
  header: {
    container: {
      web: 'h-[64px] flex items-center justify-between px-[16px]',
      mobile: 'h-[64px] flex items-center justify-between px-[16px]',
    },
    title: {
      web: 'text-[17px] font-semibold',
      mobile: 'text-[16px] font-semibold',
    },
  },

  // Chat Window
  chatWindow: {
    messagesArea: {
      web: 'py-[16px]',
      mobile: 'py-[12px]',
    },
    welcomeBanner: {
      container: {
        web: 'px-[24px] pt-[24px] pb-[16px]',
        mobile: 'px-[16px] pt-[20px] pb-[12px]',
      },
      iconWrapper: {
        web: 'w-[48px] h-[48px] mb-[12px]',
        mobile: 'w-[40px] h-[40px] mb-[10px]',
      },
      title: {
        web: 'text-[14px] font-semibold mb-[4px]',
        mobile: 'text-[13px] font-semibold mb-[4px]',
      },
      message: {
        web: 'text-[14px] leading-[1.5]',
        mobile: 'text-[13px] leading-[1.5]',
      },
    },
  },

  // Chat Bubble
  bubble: {
    container: 'w-full mb-[8px] px-[16px]',
    paper: {
      web: 'px-[12px] py-[10px]',
      mobile: 'px-[10px] py-[8px]',
    },
    text: {
      web: 'text-[14px] leading-[1.4]',
      mobile: 'text-[13px] leading-[1.4]',
    },
    timestamp: 'text-[11px] mt-[4px]',
  },

  // Input
  input: {
    container: {
      web: 'p-[12px] gap-[8px]',
      mobile: 'p-[10px] gap-[6px]',
    },
    button: {
      web: 'w-[40px] h-[40px]',
      mobile: 'w-[36px] h-[36px]',
    },
  },

  // Session List
  sessionList: {
    listItem: {
      web: 'px-[16px] py-[12px]',
      mobile: 'px-[12px] py-[10px]',
    },
  },
};
