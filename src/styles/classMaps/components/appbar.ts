export const appbarClasses = {
  boxes: {
    form: {
      web: 'flex items-center min-w-[200px] h-[56px] border-[1px] border-[#00000025] rounded-[10px] text-[#000] justify-between px-[24px] py-[18px]',
      mobile:
        'flex items-center w-[88.78vw] h-[40px] bg-[#f6f6f6] rounded-[12px] gap-[8px] mx-auto px-[10px]',
    },
    logo: {
      web: 'flex items-center justify-center w-[146px] h-100%',
      mobile: 'flex items-center justify-center w-[100px] h-100%',
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
    mobile: 'flex bg-[#f6f6f6] w-full justify-center',
  },
  inputBase: {
    web: 'flex w-full text-[#303030] [&_.MuiInputBase-input]:text-[#303030]',
    mobile: 'flex w-full text-[#0b0b0b] leading-[100%] text-[15px] font-medium',
  },
  toolBar: 'flex items-center justify-between',
  arrowBackIos: {
    web: `w-[28px] h-[28px] text-[#303030] mx-auto`,
    mobile: `w-[24px] h-[24px]`,
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
    web: 'bg-white min-h-[142px] mt-[16px]',
    mobile: 'hidden',
  },
  backButton: {
    web: 'hidden',
    mobile: 'flex justify-center ml-[5px]',
  },
};
