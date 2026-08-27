export const signupClasses = {
  boxes: {
    page: {
      // Mockup XMobile.dc.html:2143-2163 mirrors sign-in: form pane on the
      // left, brand panel on the right. Not wrapped in <Layout>, so this page
      // owns its own viewport height.
      web: 'w-full min-h-screen flex flex-row bg-white',
      mobile: 'w-full min-h-full flex flex-col bg-white px-7 pt-3 pb-10',
    },
    formPane: {
      web: 'flex-1 flex flex-col items-center justify-center p-[48px] relative',
      mobile: 'contents',
    },
    logo: {
      web: 'w-0',
      mobile: 'w-[132px] mb-7',
    },
    main: {
      // 400px column (mockup:2144) widened to 460px: our form keeps all five
      // real fields, and the name/phone row splits in two at this width.
      web: 'w-full max-w-[460px] flex flex-col',
      mobile: 'w-full flex flex-col mt-2',
    },
    input: {
      web: 'w-full mb-4 min-w-0',
      mobile: 'w-full mb-4',
    },
    // Mockup:2147 pairs two short fields on one row; ours are name + phone.
    // `items-end` because "Номер телефона (необязательно)" wraps to two lines
    // at this column width — without it the phone input sits a line lower than
    // the name input. Bottom-aligning the cells keeps the two inputs level.
    inputRow: {
      web: 'w-full grid grid-cols-2 gap-[14px] items-end',
      mobile: 'contents',
    },
    inputs: {
      web: 'w-full',
      mobile: 'flex flex-col w-full',
    },
    text: {
      // Web shows "Already have one? Sign in" under the title (mockup:2146).
      web: 'hidden',
      mobile: 'w-full flex flex-row justify-center items-center mt-auto pt-6',
    },
    links: {
      web: 'w-full flex flex-col mt-4',
      mobile: 'w-full flex flex-col mt-4',
    },
  },
  backButton: {
    web: 'absolute left-6 top-6 w-10 h-10 rounded-full bg-fill flex items-center justify-center no-underline',
    mobile:
      'w-10 h-10 rounded-full bg-fill flex items-center justify-center no-underline mb-4',
  },
  paper: {
    web: 'flex flex-col w-full bg-transparent',
    mobile: 'flex flex-col w-full bg-transparent',
  },
  buttonSubmit: {
    web: 'normal-case font-bold w-full h-[54px] rounded-[14px] text-[16px] mt-2',
    mobile:
      'normal-case font-semibold w-full h-[54px] rounded-[15px] text-[16px] mt-2',
  },
  buttonRedirect: 'normal-case px-1 font-bold text-[14px] min-w-0',
  h3: {
    web: 'font-extrabold text-[28px] leading-[34px] tracking-[-0.02em] mb-2',
    mobile: 'font-bold text-[28px] leading-[34px] tracking-[-0.02em] mb-2',
  },
  subtitle: {
    web: 'text-[15px] leading-[1.5] mb-6',
    mobile: 'text-[15px] leading-[1.5] mb-7',
  },
  crossLink: 'text-[15px] font-bold text-navy no-underline hover:underline',
  label: {
    web: 'mb-2 text-[12px] font-semibold w-full',
    mobile: 'mb-2 text-[12px] font-semibold',
  },
  typography: 'normal-case text-[14px]',
  error: {
    web: 'flex text-[14px] mt-3',
    mobile: 'flex text-[14px] mt-3',
  },
  tooltip: {
    web: 'w-[330px] text-[13px]',
    mobile: 'text-[11px]',
  },
};
