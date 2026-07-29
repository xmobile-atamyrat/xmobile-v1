export const signupClasses = {
  boxes: {
    page: {
      web: 'w-full h-full flex flex-col items-center p-0',
      mobile: 'w-full min-h-full flex flex-col bg-white px-7 pt-3 pb-10',
    },
    logo: {
      web: 'w-0',
      mobile: 'w-[132px] mb-7',
    },
    main: {
      web: 'w-[clamp(590px,_31vw,_1500px)] h-auto flex flex-col mt-[60px] items-center justify-center',
      mobile: 'w-full flex flex-col mt-2',
    },
    input: {
      web: 'w-full mb-4',
      mobile: 'w-full mb-4',
    },
    inputs: {
      web: 'w-full',
      mobile: 'flex flex-col w-full',
    },
    text: {
      web: 'w-full flex flex-row justify-center items-center mt-6',
      mobile: 'w-full flex flex-row justify-center items-center mt-auto pt-6',
    },
    links: {
      web: 'w-full flex flex-col mt-4',
      mobile: 'w-full flex flex-col mt-4',
    },
  },
  backButton: {
    web: 'absolute left-4 top-4 w-10 h-10 rounded-full bg-fill flex items-center justify-center no-underline',
    mobile:
      'w-10 h-10 rounded-full bg-fill flex items-center justify-center no-underline mb-4',
  },
  paper: {
    web: 'flex flex-col w-full rounded-[25px] px-[36px] pt-[36px] pb-[23px] bg-fill',
    mobile: 'flex flex-col w-full bg-transparent',
  },
  buttonSubmit: {
    web: 'normal-case font-bold w-full h-[54px] rounded-[15px] text-[16px] mt-2',
    mobile:
      'normal-case font-semibold w-full h-[54px] rounded-[15px] text-[16px] mt-2',
  },
  buttonRedirect: 'normal-case px-1 font-bold text-[14px] min-w-0',
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
  typography: 'normal-case text-[14px]',
  error: {
    web: 'flex text-[14px] mt-3',
    mobile: 'flex text-[14px] mt-3',
  },
  tooltip: {
    web: 'w-[330px] text-[13px]',
    mobile: 'text-[11px]',
  },
};
