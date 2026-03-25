export const privacyPolicyClasses = {
  boxes: {
    page: {
      web: 'w-full flex justify-center py-[60px]',
      mobile: 'w-full flex py-[20px] px-[16px]',
    },
    main: {
      web: 'w-[clamp(590px,_60vw,_1200px)] flex flex-col items-center',
      mobile: 'w-full flex flex-col items-center',
    },
    section: {
      web: 'flex flex-col w-full text-left gap-[12px] mb-[24px]',
      mobile: 'flex flex-col w-full text-left gap-[8px] mb-[20px]',
    },
    sectionsWrapper: {
      web: 'flex flex-col w-full px-[48px] py-[48px] items-center',
      mobile: 'flex flex-col w-full',
    },
  },
  h1: {
    web: 'font-bold text-[48px] leading-[60px] tracking-[0] mb-[40px] text-center text-[#111]',
    mobile:
      'font-bold text-[24px] leading-[30px] tracking-[0] mb-[30px] text-left text-[#111]',
  },
  h2: {
    web: 'font-bold text-[22px] leading-[30px] text-[#111]',
    mobile: 'font-bold text-[18px] leading-[24px] text-[#111]',
  },
  p: {
    web: 'text-[16px] leading-[1.6] text-[#444] whitespace-pre-line',
    mobile: 'text-[14px] leading-[1.6] text-[#444] whitespace-pre-line',
  },
};
