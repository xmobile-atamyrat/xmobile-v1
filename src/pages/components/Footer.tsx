import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import {
  Box,
  Typography,
  useMediaQuery,
  useTheme,
  IconButton,
} from '@mui/material';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import InstagramIcon from '@mui/icons-material/Instagram';
import TikTokIcon from '@/pages/components/TikTokIcon';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
};

const phoneNumbers = ['+99361004933', '+99371211717', '+99342230620'];

// Brother, or I think nowadays it is also possible to call from laptop/pc, should I uncomment this part?

/* const handleClick = (number: string) => {
	const userAgent = navigator.userAgent;

	if (/android/i.test(userAgent)) {
		// Android
		window.location.href = `tel:${number}`;
	} else if (/iPad|iPhone|iPod/.test(userAgent)) {
		// iOS
		window.location.href = `tel:${number}`;
	} else {
		// Web
		console.info('Running on Web');
	}
}; */

export default function Footer() {
  const t = useTranslations();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const [maxHeight, setMaxHeight] = useState(684);

  useEffect(() => {
    setMaxHeight(
      isMdUp
        ? window.innerHeight - appBarHeight
        : window.innerHeight - mobileAppBarHeight,
    );
  }, [isMdUp]);

  return (
    <Box
      className={`p-10 bg-gray-100`}
      sx={{
        height: { xs: `${maxHeight}px`, md: '50%' },
      }}
    >
      <Box className="flex justify-center w-auto h-full">
        {/* Footer Stack */}
        <Box className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          {/* Xmobile logo, address */}
          <Box className="flex flex-col pb-6">
            {/* logo */}
            <Typography
              className="pl-6"
              variant="h4"
              style={{ fontWeight: 'bold' }}
              paddingBottom={5}
            >
              <Link href="/">X-Mobile</Link>
            </Typography>
            {/* Address-icon */}
            <Box className="flex">
              <LocationOnIcon />
              <Typography fontWeight={400} fontSize={isMdUp ? 16 : 14}>
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
          <Box className="flex flex-col pb-6">
            <Typography fontSize={isMdUp ? 20 : 18} fontWeight={600}>
              {t('contact')}
            </Typography>
            <Box className="">
              {[0, 1, 2].map((number) => (
                <Typography
                  margin={2}
                  key={phoneNumbers[number]}
                  fontSize={isMdUp ? 16 : 14}
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
              <Typography margin={2} fontSize={isMdUp ? 16 : 14}>
                <b>E-mail:</b> <a href="mailto: ">xmobiletm@gmail.com</a>
              </Typography>
            </Box>
          </Box>

          {/* social media */}
          <Box className="flex flex-col pb-6">
            <Typography fontSize={isMdUp ? 20 : 18} fontWeight={600}>
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
        <Typography
          className="bold flex justify-center"
          fontWeight={'bold'}
          fontSize={14}
        >
          &copy; 2025 X-Mobile
        </Typography>
      </Box>
    </Box>
  );
}
