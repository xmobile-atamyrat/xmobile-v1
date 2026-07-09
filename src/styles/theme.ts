import { Onest } from 'next/font/google';

// Design-system tokens (navy/red/ink), see xmobile-app-redesign/project/XMobile.dc.html
export const navy = '#20166E';
export const red = '#E41E2B';
export const ink = '#17161D';
export const muted = '#8B8A98';
export const hairline = '#ECECF1';
export const fill = '#F5F5F8';
export const pageBg = '#E9E8EE';

export const colors = {
  text: {
    web: ink,
    mobile: navy,
  },
  blackText: ink,
  main: navy,
  mainWebMobile: {
    web: navy,
    mobile: ink,
  },
  paperBackground: {
    web: fill,
    mobile: '#fff',
  },
  border: {
    web: '#fff',
    mobile: hairline,
  },
  borderHover: {
    web: navy,
    mobile: navy,
  },
  placeholder: muted,
  buttonHoverBg: '#1A1258',
  lightRed: '#FDECEE',
  darkBlue: navy,
  white: '#fff',
  black: '#000',
};

export const fontClassName = Onest({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800'],
});

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  input: 12,
  card: 16,
  pill: 999,
};

export const units = {
  inputHeight: {
    web: '60px',
    mobile: '48px',
  },
  inputFontSize: {
    web: '18px',
    mobile: '14px',
  },
  breadcrumbs: {
    web: 10,
    mobile: 4,
  },
  mt: {
    web: 64,
    mobile: 0,
  },
};

export const img = {
  trash: {
    web: '/cart/icons/deleteIcon.png',
    mobile: '/cart/icons/deleteIconMobile.png',
  },
  not_found: {
    web: '/icons/404.png',
    mobile: '/icons/404-mobile.png',
  },
};
