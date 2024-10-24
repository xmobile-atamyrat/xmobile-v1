import BASE_URL from '@/lib/ApiEndpoints';
import { ALL_PRODUCTS_CATEGORY_CARD } from '@/pages/lib/constants';
import { blobToBase64, parseName } from '@/pages/lib/utils';
import { useMediaQuery, useTheme } from '@mui/material';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface CategoryCardProps {
  name: string;
  id: string;
  initialImgUrl?: string;
  onClick: () => void;
}

export default function CategoryCard({
  initialImgUrl,
  id,
  name,
  onClick,
}: CategoryCardProps) {
  const [imgUrl, setImgUrl] = useState<string>();
  const router = useRouter();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const t = useTranslations();

  useEffect(() => {
    if (initialImgUrl != null && initialImgUrl !== ALL_PRODUCTS_CATEGORY_CARD) {
      const cacheImgUrl = sessionStorage.getItem(id);
      if (cacheImgUrl != null) {
        setImgUrl(cacheImgUrl);
      } else {
        setImgUrl('/xmobile-original-logo.jpeg');
        (async () => {
          if (initialImgUrl.startsWith('http')) {
            setImgUrl(initialImgUrl);
          } else {
            const imgFetcher = fetch(
              `${BASE_URL}/api/localImage?imgUrl=${initialImgUrl}`,
            );
            const resp = await imgFetcher;
            if (resp.ok) {
              const imgBlob = await resp.blob();
              const base64 = await blobToBase64(imgBlob);
              setImgUrl(base64);
              sessionStorage.setItem(id, base64);
            }
          }
        })();
      }
    }
  }, [initialImgUrl, id]);

  return (
    <Card
      sx={{
        width: { xs: 350, sm: 400 },
        height: { xs: 125, sm: 150 },
        ':hover': { boxShadow: 10 },
      }}
      className={`border-[1px] ${isMdUp ? 'px-6' : 'px-4'}`}
      onClick={onClick}
    >
      {initialImgUrl === ALL_PRODUCTS_CATEGORY_CARD ? (
        <Box className="w-full h-full flex justify-center items-center">
          <Typography fontWeight={600} fontSize={isMdUp ? 20 : 18}>
            {t('allProducts')}
          </Typography>
        </Box>
      ) : (
        <Box
          className={`flex flex-row justify-between items-center ${isMdUp ? 'gap-4' : 'gap-2'} w-full h-full`}
        >
          <Typography
            fontWeight={600}
            fontSize={isMdUp ? 20 : 18}
            className="flex justify-center items-center"
          >
            {parseName(name, router.locale ?? 'tk')}
          </Typography>
          <CardMedia
            component="img"
            sx={{ width: { xs: 125, sm: 150 } }}
            image={imgUrl}
            alt="Xmobile"
          />
        </Box>
      )}
    </Card>
  );
}
