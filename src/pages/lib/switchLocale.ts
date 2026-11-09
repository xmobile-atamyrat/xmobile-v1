import type { NextRouter } from 'next/router';

/**
 * Re-renders the current page in another language, keeping everything else
 * about it: filters, sort, search, page. Next builds `router.query` from the
 * first argument, so passing the bare `router.pathname` there would drop the
 * query even though `asPath` still shows it in the address bar.
 */
export const switchLocale = (router: NextRouter, locale: string) =>
  router.push(
    { pathname: router.pathname, query: router.query },
    router.asPath,
    { locale },
  );
