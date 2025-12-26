export const profileClasses = {
  boxes: {
    main: {
      web: 'w-full',
      mobile: 'w-full h-full',
    },
    loggedOutMain: {
      // web: 'w-[88.78vw] mx-auto flex flex-col my-[300px] items-center bg-[#f4f4f4]',
      web: 'flex flex-col w-[594px] mx-auto my-[300px] rounded-[25px] px-[36px] pt-[48px] pb-[23px] bg-[#f4f4f4] items-center justify-center',
      mobile:
        'w-[88.78vw] h-full mx-auto flex flex-col mt-auto justify-center items-center',
    },
    loggedOutOptions: {
      web: 'flex flex-col w-[75%] justify-between',
      mobile: 'flex flex-col w-full justify-center items-center',
    },
    loggedInMain: 'w-full h-full flex flex-col items-center',
    accountMain:
      'w-full h-[90px] py-[16px] px-[28px] gap-[16px] flex justify-center items-center mt-[25px]',
    account: 'gap-[16px] w-[86.91%] h-[60px] flex flex-col justify-center',
    divider: 'w-full h-[4px] bg-[#f6f6f6]',
    section: 'flex flex-row w-full h-[30px] items-center px-[30px] my-[20px]',
    verifyTxt: 'flex h-[20px] justify-center mt-[20px]',
    verify: 'w-[90%] flex flex-row justify-between mt-[30px] mx-auto',
    option:
      'flex justify-center items-center w-[160px] h-[50px] rounded-[12px] normal-case',
    langList: 'min-w-[110px] h-[238px] border-0 flex flex-col mt-[20px]',
    langListitemButton: 'px-[12px] gap-[10px]',
    langOption:
      'flex flex-row justify-start w-full items-center px-[12px] gap-[10px]',
  },
  typos: {
    account:
      'mt-[8px] font-medium text-[20px] leading-none tracking-normal text-[#000]',
    name: 'font-medium text-[16px] leading-none tracking-normal text-[#1b1b1b]',
    email:
      'font-regular text-[14px] leading-none tracking-normal text-[#838383]',
    sectionTxt:
      'font-medium text-[13px] leading-[18px] tracking-normal text-[#000]',
    dialogSignOut:
      'flex justify-center font-semibold text-[22px] leading-[28px] tracking-normal text-[#000]',
    verifyTxt:
      'flex justify-center font-medium text-[15px] leading-[20px] tracking-normal text-[#353636] h-[20px]',
    option: 'font-regular text-[17px] leading-[22px] tracking-normal',
    language:
      'flex justify-center font-semibold text-[22px] leading-[28px] tracking-normal text-[#000] uppercase',
    langOption:
      'text-[#303030] text-[14px] text-regular leading-[20px] tracking-normal',
  },
  dialog: {
    main: 'w-[90vw] h-[220px] rounded-[10px] bg-[#fff] flex mx-auto my-auto justify-center py-[30px] px-[20px]',
  },
  logo: 'w-[230px] mb-[30px] mx-auto',
  logInOptionsLink: {
    web: 'no-underline flex w-full justify-center items-center rounded-[12px] gap-[8px] py-[4px] px-[20px] h-[75px] mt-[25px]',
    mobile:
      'no-underline flex w-full justify-center items-center rounded-[12px] gap-[8px] py-[4px] px-[20px] h-[48px] mt-[20px]',
  },
  logInOptionsTypo: {
    web: 'font-medium text-[18px] leading-[24px] tracking-normal',
    mobile: 'font-medium text-[16px] leading-[24px] tracking-normal',
  },
  sectionIcon: 'w-[20px] h-[20px]',
  divider: 'h-[1px] text-[#e7e7e7] w-[80%]',
  btn: 'flex flex-row ml-[20px] w-full h-full items-center justify-between no-unerline p-0 normal-case',
  icons: 'w-[17px] h-[17px] text-[#000]',
  langImg: 'w-[24px] h-[18px]',
  link: {
    web: 'absolute left-4 top-4 font-base font-light text-[36px] no-underline',
    mobile: 'hidden',
  },
};
