import { GetServerSideProps } from 'next';

/**
 * Retired: the analytics dashboard lives at /admin/analytics now. Old links
 * and bookmarks land there, in the same language; that page does its own
 * staff check.
 */
export const getServerSideProps: GetServerSideProps = async (context) => ({
  redirect: {
    destination: `/${context.locale || 'ru'}/admin/analytics`,
    permanent: false,
  },
});

export default function AnalyticsRedirect(): null {
  return null;
}
