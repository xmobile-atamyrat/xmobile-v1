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
  input: {
    web: 'text-[1.8vw] font-[600] text-[#303030] leading-[46px] tracking-0 [&>input]:text-center',
    mobile: 'hidden',
  },
  detail: {
    box: {
      web: 'flex flex-row min-w-[30.78vw] h-[3.5vw] mt-[7.5vw]',
      mobile: 'flex w-[88.7vw] mx-auto mb-[30px]',
    },
    addToCart: {
      web: 'max-w-[300px] h-[3.5vw] bg-[#ff624c] gap-[10px] rounded-[10px] py-[16px] px-[40px] ml-[5.41vw] items-center hover:bg-[#ec4d38]',
      mobile:
        'w-[88.7vw] bg-[#1C1B1B] text-[#fff] h-[clamp(20px,_11.2vw,_52px)] rounded-[15px] px-[10px] gap-[8px] mx-auto',
    },
    quantityButton: 'w-[24px] h-[24px] rounded-[100%] bg-[#f4f4f4] text-[#000]',
    addToCartText: {
      web: 'justify-center font-[700] text-[1vw] leading-[30px] tracking-0 text-[#fff]',
      mobile:
        'font-[500] text-[clamp(2vw,_3.5vw,_16px)] leading-[100%] tracking-normal',
    },
  },
  iconButton: {
    web: 'w-[2.9vw] h-[2.9vw] bg-[#f4f4f4]',
    mobile: 'hidden',
  },
  inputDet:
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
