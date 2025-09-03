export const signinClasses = {
  boxes: {
    main: 'h-[100vh] flex flex-col mt-[150px] items-center',
    text: 'flex flex-row justify-center items-center mb-10',
    button: 'flex flex-col gap-2 relative min-h-[70px] mt-4',
    logo: {
      web: 'w-0',
      mobile: 'w-[200px] mb-[60px]',
    },
  },
  paper: {
    web: 'flex flex-col w-[425px] h-[400px] rounded-[16px] p-[30px] gap-1 bg-[#f4f4f4]',
    mobile: 'flex flex-col w-[90%] h-[400px] rounded-[16px] p-[0px] gap-2',
  },
  paperSignup: {
    web: 'flex flex-col w-[425px] h-[700px] rounded-[16px] p-[30px] gap-2 bg-[#f4f4f4]',
    mobile: 'flex flex-col w-[90%] h-[450px] rounded-[16px] p-[0px] gap-1',
  },
  buttonSubmit: {
    web: 'normal-case bg-[#ff624c] font-bold h-[60px] rounded-md hover:bg-[#ec4d38] text-base',
    mobile: 'normal-case bg-[#000] font-bold h-[50px] rounded-lg text-base',
  },
  buttonRedirect: 'normal-case px-2 text-[#000] font-bold',
  typo: {
    web: 'flex justify-end text-[14px] text-[#666] mb-[3px] mt-[0px]',
    mobile: 'flex justify-center mt-4 text-[#888]',
  },
  h3: {
    web: 'font-bold text-[50px]',
    mobile: 'font-bold text-[30px]',
  },
  label: {
    web: 'mb-1 mt-1',
    mobile: 'ml-[2px] mt-[10px]',
  },
  textField: {
    web: 'bg-white rounded-lg h-[60px] [&_.MuiOutlinedInput-notchedOutline]:border-[#fff] hover:[&_.MuiOutlinedInput-notchedOutline]:border-[#ff624c] focus-within:[&_.MuiOutlinedInput-notchedOutline]:border-[#ff624c]',
    mobile:
      'bg-white rounded-lg h-[50px] [&_.MuiOutlinedInput-notchedOutline]:border-[#ddd] hover:[&_.MuiOutlinedInput-notchedOutline]:border-[#ff624c] focus-within:[&_.MuiOutlinedInput-notchedOutline]:border-[#ff624c]',
  },
  link: {
    web: 'w-0',
    mobile:
      'absolute left-4 top-4 font-base text-[#222] font-light text-[25px] no-underline',
  },
};
