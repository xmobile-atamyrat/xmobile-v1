import { Inter } from 'next/font/google';

export const colors = {
  text: '#1b1b1b',
  main: '#ff624c',
  border: {
    web: '#fff',
    mobile: '#e6e6e6',
  },
  placeholder: '#838383',
  buttonBackground: {
    web: '#ec4d38',
    mobile: '#1b1b1b',
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
};
