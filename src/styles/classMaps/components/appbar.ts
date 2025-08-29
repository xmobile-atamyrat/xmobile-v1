export const appbarClasses = {
  boxes: {
    form: `flex items-center justify-center w-full bg-[#F8F9FA]`,
    logo: {
      web: 'flex items-center justify-center w-[140px] h-100%',
      mobile: 'flex items-center justify-center w-[100px] h-100%',
    },
    search: 'flex w-fit h-full items-center justify-center',
    lang: {
      web: 'flex flex-row justify-start gap-2 w-full items-center',
      mobile: 'flex flex-row justify-start gap-1 w-full items-center',
    },
    toolbar: 'flex w-fit h-full items-center justify-start',
  },
  paper: `flex items-center rounded-2xl p-[2px_4px]`,
  inputBase: 'ml-1 flex-1 text-white [&_.MuiInputBase-input]:text-white',
  toolBar: 'flex items-center justify-between',
  arrowBackIos: {
    web: `w-[28px] h-[28px]`,
    mobile: `w-[24px] h-[24px]`,
  },
  menuIcon: {
    web: `w-[34px] h-[34px]`,
    mobile: `w-[30px] h-[30px]`,
  },
  menuItem: {
    web: 'py-1 px-2',
    mobile: 'px-2',
  },
  typography: {
    web: 'text-[18px]',
    mobile: 'text-[14px]',
  },
  shoppingCCI: {
    web: 'w-[36px] h-[36px]',
    mobile: 'w-[30px] h-[30px]',
  },
  avatar: {
    web: 'w-[36px] h-[36px]',
    mobile: 'w-[30px] h-[30px]',
  },
  accCircle: {
    web: 'w-[42px] h-[42px]',
    mobile: 'w-[36px] h-[36px]',
  },
  menuItemAcc: 'flex flex-row gap-2 items-center justify-start',
  select: {
    web: 'w-[110px] h-[40px]',
    mobile: 'w-[80px] h-[36px]',
  },
};
