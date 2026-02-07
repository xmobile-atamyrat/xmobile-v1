import type { DocumentProps } from 'next/document';
import { Head, Html, Main, NextScript } from 'next/document';

export default function Document(props: DocumentProps) {
  // eslint-disable-next-line no-underscore-dangle
  const locale = props.__NEXT_DATA__?.locale || 'ru';

  // eslint-disable-next-line no-underscore-dangle
  const pageProps = props.__NEXT_DATA__?.props?.pageProps;
  const seoData = pageProps?.seoData;

  return (
    <Html lang={locale} className="notranslate" translate="no">
      <Head>
        <link rel="icon" href="/logo/xm-logo.ico" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#d32f2f" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="XMobile" />
        <link rel="apple-touch-icon" href="/logo/xm-logo.png" />

        {seoData && (
          <>
            <title>{seoData.title}</title>
            <meta name="description" content={seoData.description} />
            <link rel="canonical" href={seoData.canonicalUrl} />

            {seoData.hreflangLinks?.map((link: any) => (
              <link
                key={link.locale}
                rel="alternate"
                hrefLang={link.locale}
                href={link.url}
              />
            ))}

            <meta property="og:title" content={seoData.title} />
            <meta property="og:description" content={seoData.description} />
            <meta property="og:image" content={seoData.ogImage} />
            <meta property="og:url" content={seoData.canonicalUrl} />
            <meta property="og:type" content={seoData.ogType || 'website'} />
            <meta property="og:locale" content={seoData.ogLocale} />
          </>
        )}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
