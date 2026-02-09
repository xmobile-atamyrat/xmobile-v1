export const signupClasses = {
  boxes: {
    page: {
      web: 'w-full h-full flex flex-col items-center p-0',
      mobile: 'w-full h-full flex flex-col justify-start',
    },
    logo: {
      web: 'w-0',
      mobile: 'w-[230px] mb-[30px] mt-[60px]',
    },
    main: {
      web: 'w-[clamp(590px,_31vw,_1500px)] h-auto flex flex-col mt-[75px] items-center justify-center',
      mobile: 'w-full flex flex-col items-center',
    },
    label: {
      web: 'flex mb-[40px]',
      mobile: 'flex mb-[18px]',
    },
    input: {
      web: 'w-full h-[100px]',
      mobile: 'w-full h-[75px]',
    },
    inputs: {
      web: 'min-h-[473px]',
      mobile: 'flex flex-col w-full justify-center items-center',
    },
    text: {
      web: 'flex flex-row justify-center items-center mt-[26px]',
      mobile: 'hidden',
    },
    button:
      'flex flex-col gap-2 relative min-h-[70px] justify-center items-center',
    links: {
      web: 'w-full flex flex-col mt-[50px] mb-[20px]',
      mobile: 'w-full flex flex-col mt-[40px]',
    },
  },
  paper: {
    web: `flex flex-col w-full h-auto rounded-[25px] px-[36px] pt-[48px] mb-[25px]`,
    mobile: 'flex flex-col w-[95%] h-[450px] rounded-[16px] p-2 gap-1',
  },
  buttonSubmit: {
    web: `normal-case font-bold w-[512px] min-h-[78px] text-[20px] leading-[30px] rounded-[10px] px-[179px] py-[24px]`,
    mobile: `normal-case font-[500] w-full h-[48px] rounded-[12px] text-[16px] leading-[24px] tracking-[0]`,
  },
  buttonRedirect: 'normal-case px-2 text-[#1b1b1b] font-bold text-[16px]',
  link: {
    web: 'absolute left-4 top-4 font-base font-light text-[36px] no-underline',
    mobile:
      'absolute left-4 top-4 font-base font-light text-[24px] no-underline',
  },
  label: {
    web: 'mb-[22px] text-[20px] leading-[30px] tracking-normal',
    mobile: '',
  },
  h3: {
    web: 'font-bold text-[56px] leading-[68px] tracking-[0]',
    mobile: 'font-bold text-[24px] leading-[100%] tracking-[0]',
  },
  typography: 'normal-case text-[16px]',
  error: {
    web: 'flex justify-end text-[16px] mb-[30px] mt-[-35px]',
    mobile: 'flex  mb-[10px] mt-[-25px] justify-center text-[14px]',
  },
  tooltip: {
    web: 'w-[330px] text-[13px]',
    mobile: 'text-[11px]',
  },
};
