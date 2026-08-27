export const signinClasses = {
  boxes: {
    page: {
      // Web is the mockup's split screen (XMobile.dc.html:2116-2133): full-bleed
      // brand panel + form half, no page chrome. This page is not wrapped in
      // <Layout>, so it owns its own viewport height.
      web: 'w-full min-h-screen flex flex-row bg-white',
      mobile: 'w-full min-h-full flex flex-col bg-white px-7 pt-3 pb-10',
    },
    // The form half of the split; `main` is the 380px column inside it.
    formPane: {
      web: 'flex-1 flex flex-col items-center justify-center p-[56px] relative',
      mobile: 'contents',
    },
    main: {
      web: 'w-full max-w-[380px] flex flex-col',
      mobile: 'w-full flex flex-col mt-2',
    },
    logo: {
      web: 'w-0',
      mobile: 'w-[132px] mb-7',
    },
    input: {
      web: 'w-full mb-[18px]',
      mobile: 'w-full mb-4',
    },
    text: {
      // Web puts "New here? Create an account" under the title instead
      // (mockup:2125), so the bottom row is mobile-only.
      web: 'hidden',
      mobile: 'w-full flex flex-row justify-center items-center mt-auto pt-6',
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
  h3: {
    web: 'font-extrabold text-[28px] leading-[34px] tracking-[-0.02em] mb-2',
    mobile: 'font-bold text-[28px] leading-[34px] tracking-[-0.02em] mb-2',
  },
  subtitle: {
    web: 'text-[15px] leading-[1.5] mb-7',
    mobile: 'text-[15px] leading-[1.5] mb-7',
  },
  // Web swaps the mobile subtitle for the mockup's "New here? Create an
  // account" cross-link (mockup:2125).
  crossLink: 'text-[15px] font-bold text-navy no-underline hover:underline',
  label: {
    web: 'mb-2 text-[12px] font-semibold w-full',
    mobile: 'mb-2 text-[12px] font-semibold',
  },
  textField: {
    web: 'w-full',
    mobile: 'w-full',
  },
  buttonSubmit: {
    web: 'normal-case font-bold w-full h-[54px] rounded-[14px] text-[16px] mt-2',
    mobile:
      'normal-case font-semibold w-full h-[54px] rounded-[15px] text-[16px] mt-2',
  },
  // Mockup XMobile.dc.html:868-869 — or-divider, guest button.
  divider: 'w-full flex items-center gap-3 my-4',
  dividerLine: 'flex-1 h-px bg-[#ECECF1]',
  dividerText: 'text-[12px] text-[#B6B5C2]',
  // `!border` because this renders on a MUI ButtonBase, whose emotion
  // `border: 0` rule is injected after the static Tailwind sheet and wins at
  // equal specificity (same trap as step 55/58).
  guestButton:
    'w-full h-[52px] rounded-[15px] !border-[1.5px] !border-solid !border-hairline bg-white text-navy text-[15px] font-semibold flex items-center justify-center gap-2 normal-case',
  buttonRedirect: 'normal-case px-1 font-bold text-[14px] min-w-0',
  typography: 'normal-case text-[14px]',
  error: {
    web: 'flex text-[14px] mt-3',
    mobile: 'flex text-[14px] mt-3',
  },
};
