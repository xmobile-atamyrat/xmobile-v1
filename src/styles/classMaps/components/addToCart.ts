export const addToCartClasses = {
  cartIcon: {
    box: 'rounded-full bg-[rgb(25, 118, 210)] hover:bg-blue-700 shadow',
    iButton: 'rounded-full bg-blue-600 hover:bg-blue-700 shadow text-white',
    fSize: {
      web: 'text-[1.5rem]',
      mobile: 'text-[1.1rem]',
    },
  },
  circIcon: {
    box: 'flex column-reverse h-full',
    fSize: {
      web: 'w-[16px] h-[16px] text-[#303030]',
      mobile: 'text-[1.3rem]',
    },
  },
  input:
    'w-[40px] h-[40px] rounded-full bg-[#f4f4f4] mx-[16px] font-bold text-[16px] leading-[24px] tracking-normal text-[#303030] [&>input]:text-center mt-[10px]',
  price: {
    web: 'ml-[5.2vw] flex justify-center items-center',
    mobile: '',
  },
  priceText: {
    web: 'font-semibold text-[20px] leading-[30px] tracking-normal text-[#303030]',
    mobile: '',
  },
  deleteButton: {
    box: {
      web: 'ml-[clamp(10px,4vw,100px)] w-[64px] h-[64px] rounded-full border-[1px] border-[#ff624c] opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-0 top-auto flex justify-center items-center',
      mobile: '',
    },
    deleteIcon: {
      web: 'w-[25px] h-[25px] text-[#ff624c]',
      mobile: '',
    },
  },
};
