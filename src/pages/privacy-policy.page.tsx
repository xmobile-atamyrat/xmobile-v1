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

type PolicySection = {
  title: string;
  desc?: string;
  items?: string[];
  subsections?: { subtitle: string; items: string[] }[];
};

export default function PrivacyPolicy() {
  const platform = usePlatform();
  const t = useTranslations();

  const sections: PolicySection[] = [
    {
      title: t('privacyPolicyCollectTitle'),
      subsections: [
        {
          subtitle: t('privacyPolicyCollectPersonalSubtitle'),
          items: [
            t('privacyPolicyCollectPersonal1'),
            t('privacyPolicyCollectPersonal2'),
          ],
        },
        {
          subtitle: t('privacyPolicyCollectAutoSubtitle'),
          items: [
            t('privacyPolicyCollectAuto1'),
            t('privacyPolicyCollectAuto2'),
            t('privacyPolicyCollectAuto3'),
            t('privacyPolicyCollectAuto4'),
          ],
        },
        {
          subtitle: t('privacyPolicyCollectPermissionsSubtitle'),
          items: [t('privacyPolicyCollectPerm1')],
        },
      ],
    },
    {
      title: t('privacyPolicyPurposeTitle'),
      items: [
        t('privacyPolicyPurpose1'),
        t('privacyPolicyPurpose2'),
        t('privacyPolicyPurpose3'),
        t('privacyPolicyPurpose4'),
        t('privacyPolicyPurpose5'),
        t('privacyPolicyPurpose6'),
        t('privacyPolicyPurpose7'),
      ],
    },
    {
      title: t('privacyPolicySharingTitle'),
      desc: t('privacyPolicySharingDesc'),
      items: [
        t('privacyPolicySharing1'),
        t('privacyPolicySharing2'),
        t('privacyPolicySharing3'),
      ],
    },
    {
      title: t('privacyPolicySecurityTitle'),
      desc: t('privacyPolicySecurityDesc'),
    },
    {
      title: t('privacyPolicyRetentionTitle'),
      desc: t('privacyPolicyRetentionDesc'),
    },
    {
      title: t('privacyPolicyRightsTitle'),
      desc: t('privacyPolicyRightsDesc'),
      items: [
        t('privacyPolicyRights1'),
        t('privacyPolicyRights2'),
        t('privacyPolicyRights3'),
        t('privacyPolicyRights4'),
      ],
    },
    {
      title: t('privacyPolicyChildrenTitle'),
      desc: t('privacyPolicyChildrenDesc'),
    },
    {
      title: t('privacyPolicyTransferTitle'),
      desc: t('privacyPolicyTransferDesc'),
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
                  {`${idx + 1}. ${section.title}`}
                </Typography>

                {section.desc && (
                  <Typography
                    className={`${interClassname.className} ${privacyPolicyClasses.p[platform]}`}
                  >
                    {section.desc}
                  </Typography>
                )}

                {section.items && section.items.length > 0 && (
                  <ul className={privacyPolicyClasses.boxes.list[platform]}>
                    {section.items.map((item, i) => (
                      <li
                        key={i}
                        className={
                          privacyPolicyClasses.boxes.listItem[platform]
                        }
                      >
                        <Typography
                          className={`${interClassname.className} ${privacyPolicyClasses.p[platform]}`}
                        >
                          {item}
                        </Typography>
                      </li>
                    ))}
                  </ul>
                )}

                {section.subsections?.map((sub, si) => (
                  <div
                    key={si}
                    className={privacyPolicyClasses.boxes.subsection[platform]}
                  >
                    <Typography
                      className={`${interClassname.className} ${privacyPolicyClasses.subtitle[platform]}`}
                    >
                      {sub.subtitle}
                    </Typography>
                    <ul
                      className={privacyPolicyClasses.boxes.subList[platform]}
                    >
                      {sub.items.map((item, ii) => (
                        <li
                          key={ii}
                          className={
                            privacyPolicyClasses.boxes.subListItem[platform]
                          }
                        >
                          <Typography
                            className={`${interClassname.className} ${privacyPolicyClasses.p[platform]}`}
                          >
                            {item}
                          </Typography>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </Box>
            ))}

            {/* Account Deletion — /privacy-policy#account-deletion */}
            <Box
              id="account-deletion"
              className={privacyPolicyClasses.boxes.section[platform]}
            >
              <Typography
                component="h2"
                className={`${interClassname.className} ${privacyPolicyClasses.h2[platform]}`}
              >
                {t('privacyPolicyDeletionTitle')}
              </Typography>
              <Typography
                className={`${interClassname.className} ${privacyPolicyClasses.p[platform]}`}
              >
                {t('privacyPolicyDeletionDesc')}
              </Typography>
              <div className={privacyPolicyClasses.boxes.deletionBox[platform]}>
                <Typography
                  className={`${interClassname.className} ${privacyPolicyClasses.subtitle[platform]}`}
                >
                  {t('privacyPolicyDeletionHowTitle')}
                </Typography>
                <Typography
                  className={`${interClassname.className} ${privacyPolicyClasses.p[platform]}`}
                >
                  {t('privacyPolicyDeletionHowDesc')}
                </Typography>
              </div>
            </Box>
          </Box>
        </Box>
      </Box>
    </Layout>
  );
}
