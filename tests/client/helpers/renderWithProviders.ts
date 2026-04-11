import PlatformContextProvider from '@/pages/lib/PlatformContext';
import { theme } from '@/pages/lib/utils';
import { ThemeProvider } from '@mui/material/styles';
import type { AbstractIntlMessages } from 'next-intl';
import { NextIntlClientProvider } from 'next-intl';
import { render, type RenderOptions } from '@testing-library/react';
import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { createElement } from 'react';

import enMessages from '@/i18n/en.json';

type ProviderOptions = {
  locale?: string;
  messages?: AbstractIntlMessages;
};

function buildWrapper(
  locale: string,
  messages: AbstractIntlMessages,
): ({ children }: { children: ReactNode }) => ReactElement {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      ThemeProvider,
      { theme },
      createElement(
        PlatformContextProvider,
        null,
        // next-intl types require `children` on props; passing as 3rd arg breaks inference.
        // eslint-disable-next-line react/no-children-prop
        createElement(NextIntlClientProvider, {
          locale,
          messages,
          children,
        } as ComponentProps<typeof NextIntlClientProvider>),
      ),
    );
  };
}

export function renderWithProviders(
  ui: ReactElement,
  options?: ProviderOptions & Omit<RenderOptions, 'wrapper'>,
) {
  const {
    locale = 'tk',
    messages = enMessages as AbstractIntlMessages,
    ...renderOptions
  } = options ?? {};

  return render(ui, {
    wrapper: buildWrapper(locale, messages),
    ...renderOptions,
  });
}
