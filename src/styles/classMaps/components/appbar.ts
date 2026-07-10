export const appbarClasses = {
  boxes: {
    form: {
      web: 'flex items-center min-w-[200px] h-[56px] border-[1px] border-[#00000025] rounded-[10px] text-[#000] justify-between px-[24px] py-[18px]',
      mobile: 'flex items-center gap-2.5 px-5 pb-4 bg-white',
    },
    logo: {
      web: 'flex items-center justify-center w-[146px] h-100%',
      mobile: 'flex items-center justify-center w-[100px] h-100%',
    },
    header: {
      mobile: 'flex items-center justify-between px-5 pt-2 pb-[14px] bg-white',
    },
    deliverTo: {
      mobile: 'flex items-center gap-1',
    },
    search: 'flex w-fit h-full items-center justify-center',
    lang: {
      web: 'flex flex-row justify-start w-full items-center px-[12px] gap-[10px]',
      mobile: 'flex flex-row justify-start gap-1 w-full items-center',
    },
    toolbar: 'flex w-fit h-full items-center justify-start',
  },
  paper: {
    web: 'flex items-center rounded-2xl p-[2px_4px] justify-between w-full h-full',
    mobile:
      'flex-1 flex items-center gap-2.5 h-12 bg-[#F5F5F8] rounded-[14px] px-4',
  },
  inputBase: {
    web: 'flex w-full text-[#303030] [&_.MuiInputBase-input]:text-[#303030]',
    mobile:
      'flex w-full text-[#8B8A98] leading-[100%] text-[15px] font-normal placeholder-[#8B8A98]',
  },
  toolBar: 'flex items-center justify-between',
  arrowBackIos: {
    web: `w-[28px] h-[28px] text-[#303030] mx-auto`,
    mobile: `w-[24px] h-[24px] left-4`,
  },
  menuIcon: {
    web: `w-[34px] h-[34px] text-[#303030]`,
    mobile: `w-[30px] h-[30px]`,
  },
  menuItem: {
    web: 'px-[12px] gap-[10px]',
    mobile: 'px-2',
  },
  typography: {
    web: 'text-[#303030] text-[14px] text-regular leading-[20px] tracking-normal',
    mobile: 'text-[14px]',
  },
  shoppingCCI: {
    web: 'w-[28px] h-[28px] text-[#303030]',
    mobile: 'w-[30px] h-[30px]',
  },
  accCircle: {
    web: 'w-[42px] h-[42px]',
    mobile: 'w-[36px] h-[36px]',
  },
  menuItemAcc: 'flex flex-row gap-2 items-center justify-start',
  select: {
    web: 'min-w-[110px] h-[32px] border-0',
    mobile: 'w-[80px] h-[36px]',
  },
  appbar: {
    web: 'bg-white min-h-[142px] my-[16px]',
    mobile: 'sticky top-0 z-40 bg-white border-b border-[#ECECF1] pt-3',
  },
  backButton: {
    web: 'hidden',
    mobile: 'flex justify-center',
  },
  filterButton: {
    mobile:
      'w-12 h-12 rounded-[14px] bg-[#20166E] flex items-center justify-center text-white',
  },
  notificationButton: {
    mobile:
      'relative w-11 h-11 rounded-full bg-[#F5F5F8] flex items-center justify-center',
  },
};
