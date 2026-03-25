import Layout from '@/pages/components/Layout';
import { LOCALE_COOKIE_NAME, LOCALE_TO_OG_LOCALE } from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { generateHreflangLinks, getCanonicalUrl } from '@/pages/lib/seo';
import { PageSeoData } from '@/pages/lib/types';
import { privacyPolicyClasses } from '@/styles/classMaps/privacy-policy.page';
import { interClassname } from '@/styles/theme';
import { Box, Typography } from '@mui/material';
import cookie from 'cookie';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';

export const getServerSideProps: GetServerSideProps = async (context) => {
  let messages = {};
  let locale =
    cookie.parse(context.req.headers.cookie ?? '')[LOCALE_COOKIE_NAME] ?? null;

  try {
    if (locale == null) {
      locale = 'ru'; // fallback
    }
    messages = (await import(`../i18n/${context.locale}.json`)).default;
  } catch (error) {
    console.error(error);
  }

  const t = messages as Record<string, string>;

  const title = t.privacyPolicyTitle || 'Privacy Policy';
  const description = t.privacyPolicyIntroDesc || 'Xmobile Privacy Policy';

  const seoData: PageSeoData = {
    title: `${title} | Xmobile`,
    description,
    canonicalUrl: getCanonicalUrl(locale || 'ru', '/privacy-policy'),
    hreflangLinks: generateHreflangLinks('/privacy-policy'),
    ogTitle: `${title} | Xmobile`,
    ogDescription: description,
    ogType: 'website',
    ogLocale:
      LOCALE_TO_OG_LOCALE[locale as keyof typeof LOCALE_TO_OG_LOCALE] ||
      'ru_RU',
  };

  return {
    props: {
      locale,
      messages,
      seoData,
    },
  };
};

export default function PrivacyPolicy() {
  const platform = usePlatform();
  const t = useTranslations();

  const sections = [
    { title: t('privacyPolicyIntroTitle'), desc: t('privacyPolicyIntroDesc') },
    {
      title: t('privacyPolicyCollectTitle'),
      desc: t('privacyPolicyCollectDesc'),
    },
    {
      title: t('privacyPolicyPurposeTitle'),
      desc: t('privacyPolicyPurposeDesc'),
    },
    {
      title: t('privacyPolicyConsentTitle'),
      desc: t('privacyPolicyConsentDesc'),
    },
    {
      title: t('privacyPolicySharingTitle'),
      desc: t('privacyPolicySharingDesc'),
    },
    {
      title: t('privacyPolicyTransferTitle'),
      desc: t('privacyPolicyTransferDesc'),
    },
    {
      title: t('privacyPolicyStorageTitle'),
      desc: t('privacyPolicyStorageDesc'),
    },
    {
      title: t('privacyPolicyRightsTitle'),
      desc: t('privacyPolicyRightsDesc'),
    },
    {
      title: t('privacyPolicyCookiesTitle'),
      desc: t('privacyPolicyCookiesDesc'),
    },
    {
      title: t('privacyPolicyChildrenTitle'),
      desc: t('privacyPolicyChildrenDesc'),
    },
    {
      title: t('privacyPolicyChangesTitle'),
      desc: t('privacyPolicyChangesDesc'),
    },
    {
      title: t('privacyPolicyContactTitle'),
      desc: t('privacyPolicyContactDesc'),
    },
  ];

  return (
    <Layout>
      <Box className={privacyPolicyClasses.boxes.page[platform]}>
        <Box className={privacyPolicyClasses.boxes.main[platform]}>
          <Typography
            component="h1"
            className={`${interClassname.className} ${privacyPolicyClasses.h1[platform]}`}
          >
            {t('privacyPolicyTitle')}
          </Typography>

          <Box className={privacyPolicyClasses.boxes.sectionsWrapper[platform]}>
            {sections.map((section, idx) => (
              <Box
                key={idx}
                className={privacyPolicyClasses.boxes.section[platform]}
              >
                <Typography
                  component="h2"
                  className={`${interClassname.className} ${privacyPolicyClasses.h2[platform]}`}
                >
                  {section.title}
                </Typography>
                <Typography
                  className={`${interClassname.className} ${privacyPolicyClasses.p[platform]}`}
                >
                  {section.desc}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Layout>
  );
}
