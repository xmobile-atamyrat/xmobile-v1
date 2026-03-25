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
    list: {
      web: 'pl-[24px] mt-[4px]',
      mobile: 'pl-[20px] mt-[4px]',
    },
    listItem: {
      web: 'mb-[6px]',
      mobile: 'mb-[6px]',
    },
    subsection: {
      web: 'mt-[10px]',
      mobile: 'mt-[10px]',
    },
    subList: {
      web: 'pl-[24px]',
      mobile: 'pl-[20px]',
    },
    subListItem: {
      web: 'mb-[4px]',
      mobile: 'mb-[4px]',
    },
    deletionBox: {
      web: 'w-full mt-[8px] p-[20px] rounded-[8px] border border-[#e0e0e0] bg-[#f9f9f9] flex flex-col gap-[10px]',
      mobile:
        'w-full mt-[6px] p-[14px] rounded-[8px] border border-[#e0e0e0] bg-[#f9f9f9] flex flex-col gap-[8px]',
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
  subtitle: {
    web: 'text-[16px] leading-[1.6] text-[#444] whitespace-pre-line font-semibold',
    mobile:
      'text-[14px] leading-[1.6] text-[#444] whitespace-pre-line font-semibold',
  },
};
