import { currentGrade, verifyToken } from '@/pages/api/utils/authMiddleware';
import { isStaff } from '@/pages/api/utils/staffAuth';
import { REFRESH_SECRET } from '@/pages/api/utils/tokenUtils';
import { AUTH_REFRESH_COOKIE_NAME } from '@/pages/lib/constants';
import type { GetServerSideProps } from 'next';

/**
 * getServerSideProps of /admin/analytics: staff only, judged by the
 * account's current grade (a deleted or demoted account goes home). Kept out
 * of the page file so it can be tested without rendering anything.
 *
 * No seoData: _app marks the page noindex.
 */
export const adminAnalyticsServerProps: GetServerSideProps = async (ctx) => {
  const home = {
    redirect: { destination: `/${ctx.locale || 'ru'}/`, permanent: false },
  };
  const refreshToken = ctx.req.cookies[AUTH_REFRESH_COOKIE_NAME];
  if (!refreshToken) return home;
  try {
    const { userId } = await verifyToken(refreshToken, REFRESH_SECRET);
    // Go by the account's current grade, not the one baked into the cookie.
    if (!isStaff((await currentGrade(userId)) ?? undefined)) return home;
  } catch {
    return home;
  }

  return {
    props: {
      messages: (await import(`../../../i18n/${ctx.locale}.json`)).default,
    },
  };
};
