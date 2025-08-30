import BASE_URL from '@/lib/ApiEndpoints';
import { ALL_PRODUCTS_CATEGORY_CARD } from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { blobToBase64, parseName } from '@/pages/lib/utils';
import { categoryCardClasses } from '@/styles/classMaps/components/categoryCard';
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
  const t = useTranslations();
  const platform = usePlatform();

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
    <Card className={categoryCardClasses.card[platform]} onClick={onClick}>
      {initialImgUrl === ALL_PRODUCTS_CATEGORY_CARD ? (
        <Box className={categoryCardClasses.boxes.allP}>
          <Typography className={categoryCardClasses.typography[platform]}>
            {t('allProducts')}
          </Typography>
        </Box>
      ) : (
        <Box className={categoryCardClasses.boxes.cardMedia[platform]}>
          <Typography className={categoryCardClasses.typography2[platform]}>
            {parseName(name, router.locale ?? 'tk')}
          </Typography>
          <CardMedia
            component="img"
            className={categoryCardClasses.cardMedia[platform]}
            image={imgUrl}
            alt="Xmobile"
          />
        </Box>
      )}
    </Card>
  );
}
