import type { DocumentProps } from 'next/document';
import { Head, Html, Main, NextScript } from 'next/document';

export default function Document(props: DocumentProps) {
  // eslint-disable-next-line no-underscore-dangle
  const locale = props.__NEXT_DATA__?.locale || 'ru';

  return (
    <Html lang={locale} className="notranslate" translate="no">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
