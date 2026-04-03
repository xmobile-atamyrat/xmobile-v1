export const notFoundClasses = {
  container: {
    web: 'w-full h-full flex flex-col items-center justify-center min-h-[60vh]',
    mobile: 'w-full h-[100dvh] flex flex-col bg-white',
  },
  header: {
    mobile: 'flex items-center w-full p-4',
    web: 'hidden',
  },
  content: {
    web: 'flex flex-col items-center justify-center mt-12',
    mobile: 'flex flex-col items-center justify-center flex-1 pb-[15vh]',
  },
  image: {
    web: 'w-auto h-[220px] object-contain mb-8',
    mobile: 'w-auto h-[180px] object-contain mb-6',
  },
  heading: {
    web: 'font-semibold text-[20px] text-[#000] mb-6',
    mobile: 'font-semibold text-[20px] text-[#000] mb-10',
  },
  buttonContainer: {
    web: '',
    mobile: 'w-full px-5 mb-8',
  },
  button: {
    web: 'bg-[#ff624c] hover:bg-[#ec4d38] text-white font-medium py-[10px] px-8 rounded-md capitalize',
    mobile:
      'bg-[#ff624c] hover:bg-[#ec4d38] text-white font-medium py-3.5 px-8 rounded-[12px] w-full capitalize text-[16px]',
  },
};
