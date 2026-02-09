export const signinClasses = {
  boxes: {
    page: {
      web: 'w-full h-full flex flex-col items-center p-0',
      mobile: 'w-full h-full flex flex-col justify-center',
    },
    main: {
      web: 'w-[clamp(590px,_31vw,_1920px)] h-[691px] flex flex-col mt-[60px] mb-[221px] items-center p-0 justify-center',
      mobile: 'w-full h-[80%] flex flex-col items-center mt-[100px]',
    },
    text: {
      web: 'w-[350px] flex flex-row justify-center items-center',
      mobile: 'hidden',
    },
    button: {
      web: 'flex min-h-[78px] w-[522px] rounded-[10px] gap-[10px] py-[24px]  items-center',
      mobile: 'flex justify-center',
    },
    logo: {
      web: 'w-0',
      mobile: 'w-[230px] mb-[30px]',
    },
    label: {
      web: 'flex mb-[80px]',
      mobile: 'flex mb-[18px]',
    },
    input: {
      web: 'w-full h-[122px]',
      mobile: 'w-[88%] h-[75px]',
    },
    links: {
      web: 'w-full flex flex-col items-center mt-[10px]',
      mobile: 'w-full flex flex-col mt-[40px]',
    },
  },
  paper: {
    web: 'flex flex-col w-full h-[543px] rounded-[25px] px-[36px] pt-[48px] pb-[23px] bg-[#f4f4f4] items-center justify-center',
    mobile: 'flex flex-col w-full h-[250px] justify-center items-center',
  },
  buttonSubmit: {
    web: `normal-case font-bold w-full min-h-[78px] text-[18px] leading-[30px]`,
    mobile: `normal-case font-[500] w-[88%] h-[48px] rounded-[12px] text-[16px] leading-[24px] tracking-[0]`,
  },
  buttonRedirect:
    'normal-case px-2 text-[#000] font-bold text-[16px] w-[200px]',
  error: {
    web: 'flex text-[16px] mt-[10px] mr-[5px]',
    mobile: 'flex mt-[19px] mb-[-10px] justify-center text-[14px]',
  },
  h3: {
    web: 'font-bold text-[56px] leading-[68px] tracking-[0]',
    mobile: 'font-bold text-[24px] leading-[100%] tracking-[0] mb-[30px]',
  },
  label: {
    web: 'mb-[22px] text-[20px] w-full',
    mobile: '',
  },
  textField: {
    web: 'w-full h-[380px] mt-[12px]',
    mobile: 'mt-[12px]',
  },
  link: {
    web: 'absolute left-4 top-4 font-base font-light text-[36px] no-underline',
    mobile:
      'absolute left-4 top-4 font-base font-light text-[24px] no-underline',
  },
  typography: 'normal-case text-[16px] mr-[19px] justify-center w-[300px]',
};
