import { Head, Html, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en" className="notranslate" translate="no">
      <Head>
        <link rel="icon" href="/logo/xm-logo.ico" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#d32f2f" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="XMobile" />
        <link rel="apple-touch-icon" href="/logo/xm-logo.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
