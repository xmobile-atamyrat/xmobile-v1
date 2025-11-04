export const categoryCardClasses = {
  card: {
    web: 'w-[354px] h-[264px] rounded-[15px] bg-[#f4f4f4] p-[26px] relative',
    mobile:
      'w-[42.9vw] h-[100px] border-[1px] border-[#f4f5fd] gap-[8px] px-[12px] py-[10px] rounded-[16px]',
  },
  boxes: {
    allP: 'w-full h-full flex justify-center items-center',
    cardMedia: {
      web: 'flex flex-col items-start',
      mobile:
        'flex flex-col-reverse justify-between items-center w-full h-full',
    },
  },
  typography: {
    web: 'font-semibold text-[26px]',
    mobile: 'font-semibold text-[14px]',
  },
  typography2: {
    web: 'font-semibold text-[26px] leading-[36px] tracking-normal text-[#303030]',
    mobile:
      'font-regular text-[12px] leading-[100%] tracking-normal text-[#1c1b1b] text-center mt-2',
  },
  cardMedia: {
    web: 'w-[150px] absolute right-[10px] bottom-[10px]',
    mobile: 'w-[54px]',
  },
};
