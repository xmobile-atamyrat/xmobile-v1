import Layout from '@/pages/components/Layout';
import {
  LOCALE_COOKIE_NAME,
  LOCALE_TO_OG_LOCALE,
  SUPPORT_EMAIL,
  SUPPORT_PHONES,
} from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { generateHreflangLinks, getCanonicalUrl } from '@/pages/lib/seo';
import { PageSeoData } from '@/pages/lib/types';
import { accordionClasses } from '@/styles/classMaps/components/accordion';
import { privacyPolicyClasses as supportClasses } from '@/styles/classMaps/privacy-policy.page';
import { fontClassName, muted, navy } from '@/styles/theme';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Link as MuiLink,
  Typography,
} from '@mui/material';
import cookie from 'cookie';
import {
  ArrowLeft,
  ChevronDown,
  Clock,
  Mail,
  MessageCircle,
  Phone,
} from 'lucide-react';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';

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
  const router = useRouter();

  const faqItems = [
    { id: 'faq1', question: t('supportFaq1'), answer: t('supportFaq1Answer') },
    { id: 'faq2', question: t('supportFaq2'), answer: t('supportFaq2Answer') },
    { id: 'faq3', question: t('supportFaq3'), answer: t('supportFaq3Answer') },
    { id: 'faq4', question: t('supportFaq4'), answer: t('supportFaq4Answer') },
    { id: 'faq5', question: t('supportFaq5'), answer: t('supportFaq5Answer') },
  ];

  const [expandedFaq, setExpandedFaq] = useState<string | false>(false);

  const handleBackButton = () => {
    router.push('/user');
  };

  const faqAccordion = (
    <Box className={`${accordionClasses.wrapper} mt-[8px]`}>
      {faqItems.map((item) => {
        const isExpanded = expandedFaq === item.id;
        return (
          <Accordion
            key={item.id}
            disableGutters
            elevation={0}
            expanded={isExpanded}
            onChange={(_event, expand) => {
              setExpandedFaq(expand ? item.id : false);
            }}
            className={accordionClasses.item}
            sx={{
              '&:before': { display: 'none' },
              backgroundColor: isExpanded ? '#F7F6FA' : 'transparent',
            }}
          >
            <AccordionSummary
              expandIcon={
                <ChevronDown size={18} color={isExpanded ? navy : muted} />
              }
              aria-controls={`${item.id}-content`}
              id={`${item.id}-header`}
              sx={{
                px: '16px',
                minHeight: 48,
                '& .MuiAccordionSummary-content': {
                  my: '14px',
                },
              }}
            >
              <Typography
                className={`${fontClassName.className} ${accordionClasses.question}`}
              >
                {item.question}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: '16px', pt: 0, pb: '14px' }}>
              <Typography
                className={`${fontClassName.className} ${accordionClasses.answer}`}
              >
                {item.answer}
              </Typography>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );

  return (
    <Layout handleHeaderBackButton={handleBackButton}>
      <Box className={supportClasses.boxes.page[platform]}>
        {platform === 'mobile' && (
          <Box className={supportClasses.headerWrap.mobile}>
            <button
              type="button"
              onClick={handleBackButton}
              className={supportClasses.backButton.mobile}
              aria-label="back"
            >
              <ArrowLeft size={20} className="text-navy" />
            </button>
            <Typography
              className={`${fontClassName.className} ${supportClasses.headerTitle.mobile}`}
            >
              {t('supportTitle')}
            </Typography>
          </Box>
        )}

        <Box className={supportClasses.boxes.main[platform]}>
          {platform === 'web' && (
            <Typography
              component="h1"
              className={`${fontClassName.className} ${supportClasses.h1[platform]}`}
            >
              {t('supportTitle')}
            </Typography>
          )}

          <Box className={supportClasses.boxes.sectionsWrapper[platform]}>
            {platform === 'mobile' ? (
              <>
                <Typography
                  className={`${fontClassName.className} ${supportClasses.support.intro}`}
                >
                  {t('supportIntro')}
                </Typography>

                <Box className={supportClasses.support.heroRow}>
                  <Link
                    href="/chat"
                    className={supportClasses.support.heroChat}
                  >
                    <MessageCircle
                      className={supportClasses.support.heroIconChat}
                    />
                    <Typography
                      className={`${fontClassName.className} ${supportClasses.support.heroTitleChat}`}
                    >
                      {t('supportChatLink')}
                    </Typography>
                    <Typography
                      className={`${fontClassName.className} ${supportClasses.support.heroSubtitleChat}`}
                    >
                      {t('supportChatNote')}
                    </Typography>
                  </Link>
                  <a
                    href={`tel:${SUPPORT_PHONES[0].dial}`}
                    className={supportClasses.support.heroCall}
                  >
                    <Phone className={supportClasses.support.heroIconCall} />
                    <Typography
                      className={`${fontClassName.className} ${supportClasses.support.heroTitleCall}`}
                    >
                      {t('supportPhoneLabel')}
                    </Typography>
                    <Typography
                      className={`${fontClassName.className} ${supportClasses.support.heroSubtitleCall}`}
                    >
                      {SUPPORT_PHONES[0].display}
                    </Typography>
                  </a>
                </Box>

                <Typography
                  className={`${fontClassName.className} ${supportClasses.support.sectionLabel}`}
                >
                  {t('supportContactTitle')}
                </Typography>
                <Box className={supportClasses.support.card}>
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className={supportClasses.support.row}
                  >
                    <span className={supportClasses.support.rowIcon}>
                      <Mail size={19} />
                    </span>
                    <Typography
                      className={`${fontClassName.className} ${supportClasses.support.rowLabel}`}
                    >
                      {t('supportEmailLabel')}
                    </Typography>
                    <Typography
                      className={`${fontClassName.className} ${supportClasses.support.rowValue}`}
                    >
                      {SUPPORT_EMAIL}
                    </Typography>
                  </a>
                  {SUPPORT_PHONES.map((phone) => (
                    <a
                      key={phone.dial}
                      href={`tel:${phone.dial}`}
                      className={supportClasses.support.row}
                    >
                      <span className={supportClasses.support.rowIcon}>
                        <Phone size={19} />
                      </span>
                      <Typography
                        className={`${fontClassName.className} ${supportClasses.support.rowLabel}`}
                      >
                        {t(phone.labelKey)}
                      </Typography>
                      <Typography
                        className={`${fontClassName.className} ${supportClasses.support.rowValue}`}
                      >
                        {phone.display}
                      </Typography>
                    </a>
                  ))}
                </Box>

                <Typography
                  className={`${fontClassName.className} ${supportClasses.support.sectionLabel}`}
                >
                  {t('supportHoursTitle')}
                </Typography>
                <Box className={supportClasses.support.card}>
                  <Box className={supportClasses.support.row}>
                    <span className={supportClasses.support.rowIcon}>
                      <Clock size={19} />
                    </span>
                    <Typography
                      className={`${fontClassName.className} ${supportClasses.support.rowLabel}`}
                    >
                      {t('supportHoursDays')}
                    </Typography>
                    <Typography
                      className={`${fontClassName.className} ${supportClasses.support.rowValue}`}
                    >
                      {t('supportHoursTime')}
                    </Typography>
                  </Box>
                </Box>
                <Typography
                  className={`${fontClassName.className} ${supportClasses.support.hoursNote}`}
                >
                  {t('supportHoursTimezone')}
                </Typography>

                <Typography
                  className={`${fontClassName.className} ${supportClasses.support.faqLabel}`}
                >
                  {t('supportFaqTitle')}
                </Typography>
                {faqAccordion}
              </>
            ) : (
              <>
                <Typography
                  className={`${fontClassName.className} ${supportClasses.p[platform]} text-center mb-[8px]`}
                >
                  {t('supportIntro')}
                </Typography>

                <Box className={supportClasses.boxes.section[platform]}>
                  <Typography
                    component="h2"
                    className={`${fontClassName.className} ${supportClasses.h2[platform]}`}
                  >
                    {t('supportContactTitle')}
                  </Typography>

                  <Typography
                    className={`${fontClassName.className} ${supportClasses.p[platform]}`}
                  >
                    <strong>{t('supportEmailLabel')}:</strong>{' '}
                    <MuiLink
                      href={`mailto:${SUPPORT_EMAIL}`}
                      className={supportClasses.link}
                    >
                      {SUPPORT_EMAIL}
                    </MuiLink>
                  </Typography>

                  <ul className={supportClasses.boxes.list[platform]}>
                    {SUPPORT_PHONES.map((phone) => (
                      <li
                        key={phone.dial}
                        className={supportClasses.boxes.listItem[platform]}
                      >
                        <Typography
                          className={`${fontClassName.className} ${supportClasses.p[platform]}`}
                        >
                          <strong>{t(phone.labelKey)}</strong>
                          {' — '}
                          <MuiLink
                            href={`tel:${phone.dial}`}
                            className={supportClasses.link}
                          >
                            {phone.display}
                          </MuiLink>
                        </Typography>
                      </li>
                    ))}
                  </ul>

                  <Typography
                    className={`${fontClassName.className} ${supportClasses.p[platform]}`}
                  >
                    {t('supportChatNote')}:{' '}
                    <Link href="/chat" className={supportClasses.link}>
                      {t('supportChatLink')}
                    </Link>
                  </Typography>
                </Box>

                <Box className={supportClasses.boxes.section[platform]}>
                  <Typography
                    component="h2"
                    className={`${fontClassName.className} ${supportClasses.h2[platform]}`}
                  >
                    {t('supportHoursTitle')}
                  </Typography>
                  <Typography
                    className={`${fontClassName.className} ${supportClasses.p[platform]}`}
                  >
                    {t('supportHoursDays')}
                  </Typography>
                  <Typography
                    className={`${fontClassName.className} ${supportClasses.p[platform]}`}
                  >
                    {t('supportHoursTime')} {t('supportHoursTimezone')}
                  </Typography>
                </Box>

                <Box className={supportClasses.boxes.section[platform]}>
                  <Typography
                    component="h2"
                    className={`${fontClassName.className} ${supportClasses.h2[platform]}`}
                  >
                    {t('supportFaqTitle')}
                  </Typography>
                  {faqAccordion}
                </Box>
              </>
            )}
          </Box>
        </Box>
      </Box>
    </Layout>
  );
}
