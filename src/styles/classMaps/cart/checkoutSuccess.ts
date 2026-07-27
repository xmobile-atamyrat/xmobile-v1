export const checkoutSuccessClasses = {
  container: {
    web: 'flex flex-col items-center justify-center',
    mobile: 'flex flex-col w-full h-[80vh] items-center justify-center px-6',
  },
  imageContainer: {
    web: 'mb-[50px]',
    mobile: 'mb-8 flex justify-center',
  },
  image: {
    web: 'w-[317px] h-[368px]',
    mobile: 'w-[150px] h-[150px]',
  },
  // Nested success check badge (mobile) — 96px pale-green ring around a 64px green disc
  badgeOuter: {
    mobile:
      'w-24 h-24 rounded-full bg-[#E9F6EE] flex items-center justify-center mb-6',
    web: 'hidden',
  },
  badgeInner: {
    mobile:
      'w-16 h-16 rounded-full bg-[#1F9A5A] flex items-center justify-center',
    web: 'hidden',
  },
  title: {
    web: 'font-medium text-[30px] leading-[24px] text-black text-center mb-[24px]',
    mobile:
      'font-bold text-[26px] leading-[32px] tracking-[-0.01em] text-[#17161D] text-center mb-2.5',
  },
  message: {
    web: 'font-normal text-[20px] leading-[24px] text-[#303030] text-center mb-[50px] max-w-[600px]',
    mobile: 'text-center mb-8 px-2',
  },
  orderNumber: {
    web: 'font-semibold text-[20px] leading-[24px] text-black',
    mobile: 'font-bold text-[15px] leading-[22px] text-[#20166E]',
  },
  yourOrder: {
    mobile: 'font-normal text-[15px] leading-[22px] text-[#8B8A98] text-center',
    web: 'font-medium text-[18px] leading-[20px] text-[#353636] text-center',
  },
  confirmation: {
    mobile:
      'font-normal text-[15px] leading-[22px] text-[#8B8A98] text-center mt-2',
    web: 'font-medium text-[18px] leading-[20px] text-[#353636] text-center mt-2',
  },
  buttonContainer: {
    web: 'flex flex-row gap-2 w-full justify-center',
    mobile: 'flex flex-col gap-3 w-full max-w-[380px]',
  },
  button: {
    web: 'bg-[#ff624c] text-white font-bold text-[20px] leading-[30px] rounded-[10px] py-[16px] px-[40px] normal-case w-[210px]',
    mobile:
      'bg-[#1b1b1b] text-white font-medium text-[16px] leading-normal rounded-[12px] h-12 w-full max-w-[380px] normal-case',
  },
  buttonPrimary: {
    mobile:
      'text-white font-semibold text-[16px] leading-normal rounded-[15px] h-[54px] w-full normal-case',
    web: 'hidden',
  },
  buttonSecondary: {
    mobile:
      'bg-white font-semibold text-[16px] leading-normal rounded-[15px] h-[54px] w-full normal-case border-[1.5px] border-solid border-[#E4E3EB]',
    web: 'hidden',
  },
  iconContainer: {
    mobile: 'mb-8',
    web: 'hidden',
  },
  icon: {
    mobile: 'w-[200px] h-[200px]',
    web: 'hidden',
  },
};
