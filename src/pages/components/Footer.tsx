import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { parseName } from '@/pages/lib/utils';
import { footerClasses } from '@/styles/classMaps/components/footer';
import { interClassname } from '@/styles/theme';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import MailIcon from '@mui/icons-material/Mail';
import PhoneIcon from '@mui/icons-material/Phone';
import { Box, CardMedia, Divider, Typography } from '@mui/material';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/router';

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
  const router = useRouter();
  const { categories: allCategories } = useCategoryContext();

  return (
    <Box className={footerClasses.boxes.main[platform]}>
      <Box className={footerClasses.boxes.main2}>
        {/* Footer Stack */}
        <Box className={footerClasses.boxes.footerStack[platform]}>
          {/* Xmobile logo, address */}
          <Box className={footerClasses.boxes.menu}>
            {/* logo */}
            <Link href="/">
              <CardMedia
                component="img"
                image="xmobile-processed-logo.png"
                alt="Logo"
                className="w-[7.55vw]"
              />
            </Link>
          </Box>

          {/* contacts */}
          <Box className={footerClasses.boxes.menu}>
            <Box className="flex flex-row items-center">
              <PhoneIcon className="text-[#221765]" />
              <Box className="flex flex-col ml-[5px]">
                {[0, 1, 2].map((number) => (
                  <Typography
                    key={phoneNumbers[number]}
                    className={`${footerClasses.typography[platform]} ${interClassname.className}`}
                  >
                    <a
                      href={`tel:${phoneNumbers[number]}`}
                      /* onClick={() => handleClick(number)} */
                    >
                      {phoneNumbers[number]}
                    </a>
                  </Typography>
                ))}
              </Box>
            </Box>
            <Box className="flex flex-row my-[16px]">
              <MailIcon className="text-[#221765]" />
              <Typography
                className={`${footerClasses.typography[platform]} ${interClassname.className} ml-[5px]`}
              >
                <a href="mailto: ">xmobiletm@gmail.com</a>
              </Typography>
            </Box>
            {/* Address-icon */}
            <Box className="flex items-center w-[26vw] mr-[50px]">
              <LocationOnIcon className="text-[#221765]" />
              <Typography
                className={`${footerClasses.typography[platform]} ${interClassname.className} ml-[5px]`}
              >
                <Link
                  href={'https://maps.app.goo.gl/sYc6VJSSFJW1aUd76'}
                  target="_blank"
                >
                  {t('address')}
                </Link>
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* social media */}
        <Box className={`${footerClasses.boxes.menu} min-w-[14vw] mr-[50px]`}>
          <Typography
            className={`${footerClasses.typoContact[platform]} ${interClassname.className} mb-[12px]`}
          >
            {t('followUs')}
          </Typography>

          <Box className="flex flex-col">
            <Link
              target="_blank"
              href={'https://www.instagram.com/xmobiletm/'}
              className="my-[12px]"
            >
              <Typography
                className={`${interClassname.className} ${footerClasses.socialLinks}`}
              >
                Instagram
              </Typography>
            </Link>
            <Link target="_blank" href={'https://www.tiktok.com/@xmobiletm'}>
              <Typography
                className={`${interClassname.className} ${footerClasses.socialLinks}`}
              >
                TikTok
              </Typography>
            </Link>
          </Box>
        </Box>

        {/* Categories */}
        <Box className={`${footerClasses.boxes.menu}`}>
          <Typography
            className={`${interClassname.className} font-semibold text-[20px] leading-[30px] tracking-normal text-[#303030]`}
          >
            {t('allCategory')}
          </Typography>
          <Box className="grid grid-cols-2 mt-[24px] gap-[12px] gap-x-[35px]">
            {allCategories.map((category) => {
              return (
                <Typography
                  key={category.id}
                  className={`${interClassname.className} font-regular text-[16px] leading-[24px] tracking-normal text-[#303030]`}
                  // To-Do make categories functionable
                >
                  {parseName(category.name, router.locale ?? 'tk')}
                </Typography>
              );
            })}
          </Box>
        </Box>
      </Box>
      <Divider className="w-full" />

      <Box className="my-[24px] flex justify-center">
        <Typography
          className={`${footerClasses.boxes.copyright} ${interClassname.className}`}
        >
          &copy; X-mobile © 2025. All Rights Reserved.
        </Typography>
      </Box>
    </Box>
  );
}
