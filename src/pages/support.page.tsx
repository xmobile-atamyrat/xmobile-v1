import Layout from '@/pages/components/Layout';
import { LOCALE_COOKIE_NAME, LOCALE_TO_OG_LOCALE } from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { generateHreflangLinks, getCanonicalUrl } from '@/pages/lib/seo';
import { PageSeoData } from '@/pages/lib/types';
import { privacyPolicyClasses as supportClasses } from '@/styles/classMaps/privacy-policy.page';
import { interClassname } from '@/styles/theme';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Link as MuiLink,
  Typography,
} from '@mui/material';
import cookie from 'cookie';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';

const SUPPORT_EMAIL = 'xmobiletm@gmail.com';
const SUPPORT_PHONES = ['+99361004933', '+99371211717', '+99342230620'];

export const getServerSideProps: GetServerSideProps = async (context) => {
  let messages = {};
  const cookieLocale = cookie.parse(context.req.headers.cookie ?? '')[
    LOCALE_COOKIE_NAME
  ];
  const locale =
    context.locale !== context.defaultLocale
      ? context.locale!
      : cookieLocale ?? context.locale ?? 'ru';

  try {
    messages = (await import(`../i18n/${locale}.json`)).default;
  } catch (error) {
    console.error(error);
  }

  const t = messages as Record<string, string>;

  const title = t.supportTitle || 'XMobile Support';
  const description =
    t.supportMetaDescription ||
    'Contact XMobile support for orders, payments, delivery, and technical help.';

  const seoData: PageSeoData = {
    title: `${title} | Xmobile`,
    description,
    canonicalUrl: getCanonicalUrl(locale || 'ru', '/support'),
    hreflangLinks: generateHreflangLinks('/support'),
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

export default function SupportPage() {
  const platform = usePlatform();
  const t = useTranslations();

  const faqItems = [
    { id: 'faq1', question: t('supportFaq1'), answer: t('supportFaq1Answer') },
    { id: 'faq2', question: t('supportFaq2'), answer: t('supportFaq2Answer') },
    { id: 'faq3', question: t('supportFaq3'), answer: t('supportFaq3Answer') },
    { id: 'faq4', question: t('supportFaq4'), answer: t('supportFaq4Answer') },
    { id: 'faq5', question: t('supportFaq5'), answer: t('supportFaq5Answer') },
  ];

  const [expandedFaq, setExpandedFaq] = useState<string | false>(false);

  const linkClass = 'text-[#1a73e8] underline hover:text-[#1558b0]';

  return (
    <Layout>
      <Box className={supportClasses.boxes.page[platform]}>
        <Box className={supportClasses.boxes.main[platform]}>
          <Typography
            component="h1"
            className={`${interClassname.className} ${supportClasses.h1[platform]}`}
          >
            {t('supportTitle')}
          </Typography>

          <Box className={supportClasses.boxes.sectionsWrapper[platform]}>
            <Typography
              className={`${interClassname.className} ${supportClasses.p[platform]} text-center mb-[8px]`}
            >
              {t('supportIntro')}
            </Typography>

            <Box className={supportClasses.boxes.section[platform]}>
              <Typography
                component="h2"
                className={`${interClassname.className} ${supportClasses.h2[platform]}`}
              >
                {t('supportContactTitle')}
              </Typography>

              <Typography
                className={`${interClassname.className} ${supportClasses.p[platform]}`}
              >
                <strong>{t('supportEmailLabel')}:</strong>{' '}
                <MuiLink href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>
                  {SUPPORT_EMAIL}
                </MuiLink>
              </Typography>

              <Typography
                className={`${interClassname.className} ${supportClasses.p[platform]}`}
              >
                <strong>{t('supportPhoneLabel')}:</strong>
              </Typography>
              <ul className={supportClasses.boxes.list[platform]}>
                {SUPPORT_PHONES.map((phone) => (
                  <li
                    key={phone}
                    className={supportClasses.boxes.listItem[platform]}
                  >
                    <Typography
                      className={`${interClassname.className} ${supportClasses.p[platform]}`}
                    >
                      <MuiLink href={`tel:${phone}`} className={linkClass}>
                        {phone}
                      </MuiLink>
                    </Typography>
                  </li>
                ))}
              </ul>

              <Typography
                className={`${interClassname.className} ${supportClasses.p[platform]}`}
              >
                {t('supportChatNote')}{' '}
                <Link href="/chat" className={linkClass}>
                  {t('supportChatLink')}
                </Link>
              </Typography>
            </Box>

            <Box className={supportClasses.boxes.section[platform]}>
              <Typography
                component="h2"
                className={`${interClassname.className} ${supportClasses.h2[platform]}`}
              >
                {t('supportHoursTitle')}
              </Typography>
              <Typography
                className={`${interClassname.className} ${supportClasses.p[platform]}`}
              >
                {t('supportHoursDays')}
              </Typography>
              <Typography
                className={`${interClassname.className} ${supportClasses.p[platform]}`}
              >
                {t('supportHoursTime')}
              </Typography>
            </Box>

            <Box className={supportClasses.boxes.section[platform]}>
              <Typography
                component="h2"
                className={`${interClassname.className} ${supportClasses.h2[platform]}`}
              >
                {t('supportFaqTitle')}
              </Typography>
              <Box className="w-full mt-[8px]">
                {faqItems.map((item) => (
                  <Accordion
                    key={item.id}
                    disableGutters
                    elevation={0}
                    expanded={expandedFaq === item.id}
                    onChange={(_event, isExpanded) => {
                      setExpandedFaq(isExpanded ? item.id : false);
                    }}
                    sx={{
                      borderBottom: '1px solid #e0e0e0',
                      '&:before': { display: 'none' },
                      backgroundColor: 'transparent',
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      aria-controls={`${item.id}-content`}
                      id={`${item.id}-header`}
                      sx={{
                        px: 0,
                        minHeight: 48,
                        '& .MuiAccordionSummary-content': {
                          my: 1,
                        },
                      }}
                    >
                      <Typography
                        className={`${interClassname.className} ${supportClasses.subtitle[platform]}`}
                      >
                        {item.question}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ px: 0, pt: 0, pb: 2 }}>
                      <Typography
                        className={`${interClassname.className} ${supportClasses.p[platform]}`}
                      >
                        {item.answer}
                      </Typography>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Layout>
  );
}
