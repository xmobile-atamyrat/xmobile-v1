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
  title: {
    web: 'font-medium text-[30px] leading-[24px] text-black text-center mb-[24px]',
    mobile: 'font-bold text-[22px] leading-[28px] text-black text-center mb-4',
  },
  message: {
    web: 'font-normal text-[20px] leading-[24px] text-[#303030] text-center mb-[50px] max-w-[600px]',
    mobile:
      'font-medium text-[12px] leading-[20px] text-[#353636] text-center mb-6 px-4',
  },
  orderNumber: {
    web: 'font-semibold text-[20px] leading-[24px] text-black',
    mobile: 'font-semibold text-[15px] leading-[20px] text-black',
  },
  button: {
    web: 'bg-[#ff624c] text-white font-bold text-[20px] leading-[30px] rounded-[10px] py-[16px] px-[40px] normal-case',
    mobile:
      'bg-[#1b1b1b] text-white font-medium text-[16px] leading-normal rounded-[12px] h-12 w-full max-w-[380px] normal-case',
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
