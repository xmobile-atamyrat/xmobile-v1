import { detectMobileOs, storeUrlFor } from '@/pages/lib/appDownload';
import { GetServerSideProps } from 'next';

/**
 * Where the footer QR code points: a phone camera opens it and lands in its
 * own store. Anything that isn't a phone goes to the storefront instead.
 * A temporary redirect, so the target can change without browsers caching it.
 */
export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const os = detectMobileOs(req.headers['user-agent'] ?? '');
  return {
    redirect: { destination: os ? storeUrlFor(os) : '/', permanent: false },
  };
};

export default function AppDownloadRedirect(): null {
  return null;
}
