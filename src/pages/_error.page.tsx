import NextError, { ErrorProps } from 'next/error';
import { NextPageContext } from 'next';

// Next's built-in error page passes no messages, so the translated components
// _app renders around every page (e.g. the notification prompt) threw
// MISSING_MESSAGE on every 500. Load the locale's messages and keep the
// built-in page.
export default function Error({ statusCode }: ErrorProps) {
  return <NextError statusCode={statusCode} />;
}

Error.getInitialProps = async (context: NextPageContext) => {
  const errorProps = await NextError.getInitialProps(context);
  const locale = context.locale ?? context.defaultLocale ?? 'ru';
  return {
    ...errorProps,
    messages: (await import(`../i18n/${locale}.json`)).default,
  };
};
