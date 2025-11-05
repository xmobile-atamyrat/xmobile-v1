import { Inter } from 'next/font/google';

export const colors = {
  text: {
    web: '#303030',
    mobile: '#221765',
  },
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
  buttonHoverBg: {
    web: '#ec4d38',
    mobile: '#000543',
  },
  buttonBg: {
    web: '#ff624c',
    mobile: '#110654',
  },
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
