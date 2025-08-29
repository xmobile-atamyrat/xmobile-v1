import TikTokIcon from '@/pages/components/TikTokIcon';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { footerClasses } from '@/styles/classMaps/components/footer';
import InstagramIcon from '@mui/icons-material/Instagram';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { Box, IconButton, Typography } from '@mui/material';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
};

const phoneNumbers = ['+99361004933', '+99371211717', '+99342230620'];

export default function Footer() {
  const t = useTranslations();
  const platform = usePlatform();

  return (
    <Box className={footerClasses.boxes.main}>
      <Box className={footerClasses.boxes.main2}>
        {/* Footer Stack */}
        <Box className={footerClasses.boxes.footerStack[platform]}>
          {/* Xmobile logo, address */}
          <Box className={footerClasses.boxes.menu}>
            {/* logo */}
            <Typography className="pl-6 font-bold pb-5" variant="h4">
              <Link href="/">X-Mobile</Link>
            </Typography>
            {/* Address-icon */}
            <Box className="flex">
              <LocationOnIcon />
              <Typography className={footerClasses.typography[platform]}>
                <Link
                  href={'https://maps.app.goo.gl/sYc6VJSSFJW1aUd76'}
                  target="_blank"
                >
                  {t('address')}
                </Link>
              </Typography>
            </Box>
          </Box>

          {/* contacts */}
          <Box className={footerClasses.boxes.menu}>
            <Typography className={footerClasses.typoContact[platform]}>
              {t('contact')}
            </Typography>
            <Box className="">
              {[0, 1, 2].map((number) => (
                <Typography
                  key={phoneNumbers[number]}
                  className={footerClasses.typography[platform]}
                >
                  <b>
                    {t('mobilePhone')} {number + 1}:{' '}
                  </b>
                  <a
                    href={`tel:${phoneNumbers[number]}`}
                    className="pl-3" /* onClick={() => handleClick(number)} */
                  >
                    {phoneNumbers[number]}
                  </a>
                </Typography>
              ))}
              <Typography className={footerClasses.typography[platform]}>
                <b>E-mail:</b> <a href="mailto: ">xmobiletm@gmail.com</a>
              </Typography>
            </Box>
          </Box>

          {/* social media */}
          <Box className={footerClasses.boxes.menu}>
            <Typography className={footerClasses.typoContact[platform]}>
              {t('followUs')}
            </Typography>

            <Box className="flex flex-col">
              <Link
                target="_blank"
                href={'https://www.instagram.com/xmobiletm/'}
              >
                <IconButton>
                  <InstagramIcon className="text-black"></InstagramIcon>
                </IconButton>
                Instagram
              </Link>
              <Link target="_blank" href={'https://www.tiktok.com/@xmobiletm'}>
                <IconButton>
                  <TikTokIcon />
                </IconButton>
                TikTok
              </Link>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box>
        <Typography className={footerClasses.boxes.copyright}>
          &copy; 2025 X-Mobile
        </Typography>
      </Box>
    </Box>
  );
}
