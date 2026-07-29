export const signinClasses = {
  boxes: {
    page: {
      web: 'w-full h-full flex flex-col items-center p-0',
      mobile: 'w-full min-h-full flex flex-col bg-white px-7 pt-3 pb-10',
    },
    main: {
      web: 'w-[clamp(590px,_31vw,_1920px)] h-[691px] flex flex-col mt-[60px] mb-[221px] items-center p-0 justify-center',
      mobile: 'w-full flex flex-col mt-2',
    },
    logo: {
      web: 'w-0',
      mobile: 'w-[132px] mb-7',
    },
    input: {
      web: 'w-full mb-4',
      mobile: 'w-full mb-4',
    },
    text: {
      web: 'w-full flex flex-row justify-center items-center mt-6',
      mobile: 'w-full flex flex-row justify-center items-center mt-auto pt-6',
    },
  },
  backButton: {
    web: 'absolute left-4 top-4 w-10 h-10 rounded-full bg-fill flex items-center justify-center no-underline',
    mobile:
      'w-10 h-10 rounded-full bg-fill flex items-center justify-center no-underline mb-4',
  },
  paper: {
    web: 'flex flex-col w-full rounded-[25px] px-[36px] pt-[36px] pb-[23px] bg-fill items-center',
    mobile: 'flex flex-col w-full bg-transparent',
  },
  h3: {
    web: 'font-bold text-[40px] leading-[48px] tracking-[-0.02em] mb-2 self-start',
    mobile: 'font-bold text-[28px] leading-[34px] tracking-[-0.02em] mb-2',
  },
  subtitle: {
    web: 'text-[15px] leading-[1.5] mb-7 self-start',
    mobile: 'text-[15px] leading-[1.5] mb-7',
  },
  label: {
    web: 'mb-[12px] text-[14px] font-semibold w-full',
    mobile: 'mb-2 text-[12px] font-semibold',
  },
  textField: {
    web: 'w-full',
    mobile: 'w-full',
  },
  buttonSubmit: {
    web: 'normal-case font-bold w-full h-[54px] rounded-[15px] text-[16px] mt-2',
    mobile:
      'normal-case font-semibold w-full h-[54px] rounded-[15px] text-[16px] mt-2',
  },
  // Mockup XMobile.dc.html:868-869 — or-divider, guest button.
  divider: 'w-full flex items-center gap-3 my-4',
  dividerLine: 'flex-1 h-px bg-[#ECECF1]',
  dividerText: 'text-[12px] text-[#B6B5C2]',
  guestButton:
    'w-full h-[52px] rounded-[15px] border-[1.5px] border-hairline bg-white text-navy text-[15px] font-semibold flex items-center justify-center gap-2 normal-case',
  buttonRedirect: 'normal-case px-1 font-bold text-[14px] min-w-0',
  typography: 'normal-case text-[14px]',
  error: {
    web: 'flex text-[14px] mt-3',
    mobile: 'flex text-[14px] mt-3',
  },
};
