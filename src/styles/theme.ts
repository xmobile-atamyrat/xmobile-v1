import { Inter } from 'next/font/google';

export const colors = {
  text: {
    web: '#303030',
    mobile: '#ff624c',
  },
  blackText: '#303030',
  main: '#ff624c',
  mainWebMobile: {
    web: '#ff624c',
    mobile: '#1b1b1b',
  },
  paperBackground: {
    web: '#f4f4f4',
    mobile: '#fff',
  },
  border: {
    web: '#fff',
    mobile: '#e6e6e6',
  },
  borderHover: {
    web: '#ff624c',
    mobile: '#554ba8',
  },
  placeholder: '#838383',
  buttonHoverBg: '#ec4d38',
  darkBlue: '#221765',
  white: '#fff',
  black: '#000',
};

export const interClassname = Inter({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
});

export const units = {
  inputHeight: {
    web: '80px',
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
    web: '/deleteIcon.png',
    mobile: '/deleteIconMobile.png',
  },
};
