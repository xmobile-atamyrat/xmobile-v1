// Web-only brand panel shared by /user/signin and /user/signup.
// Mockup XMobile.dc.html:2117-2121 (sign in, panel left) and 2147-2152
// (sign up, panel right with the gradient reversed).
export const authPanelClasses = {
  panel:
    'flex flex-1 flex-col justify-center p-[56px] text-white relative overflow-hidden',
  gradient: {
    // 150deg navy → indigo; sign-up mirrors the page so the gradient flips too.
    normal: 'bg-[linear-gradient(150deg,#20166E,#2B1F8F)]',
    reversed: 'bg-[linear-gradient(150deg,#2B1F8F,#20166E)]',
  },
  logo: 'h-[44px] w-auto self-start mb-9 brightness-0 invert',
  title:
    'text-[38px] font-extrabold leading-[1.15] tracking-[-0.02em] mb-4 max-w-[560px]',
  subtitle:
    'text-[16px] leading-[1.6] text-white/75 mb-8 max-w-[420px] font-normal',
  features: 'flex flex-col gap-[14px]',
  feature: 'flex flex-row items-center gap-3 text-[15px] text-white/90',
};
