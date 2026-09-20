import { ALL_PRODUCTS_CATEGORY_CARD } from '@/pages/lib/constants';
import {
  getCategoryMediaUrl,
  PRODUCT_IMAGE_FALLBACK,
} from '@/pages/lib/mediaUrls';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { parseName } from '@/pages/lib/utils';
import { categoryCardClasses } from '@/styles/classMaps/components/categoryCard';
import { fontClassName } from '@/styles/theme';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMemo } from 'react';

interface CategoryCardProps {
  name: string;
  initialImgUrl?: string;
  href?: string;
  onClick?: () => void;
}

export default function CategoryCard({
  initialImgUrl,
  name,
  href,
  onClick,
}: CategoryCardProps) {
  const router = useRouter();
  const t = useTranslations();
  const platform = usePlatform();

  const imgSrc = useMemo(() => {
    if (
      initialImgUrl == null ||
      initialImgUrl === '' ||
      initialImgUrl === ALL_PRODUCTS_CATEGORY_CARD
    ) {
      return undefined;
    }
    if (initialImgUrl.startsWith('http')) return initialImgUrl;
    return getCategoryMediaUrl(initialImgUrl) ?? PRODUCT_IMAGE_FALLBACK;
  }, [initialImgUrl]);

  const content =
    initialImgUrl === ALL_PRODUCTS_CATEGORY_CARD ? (
      <Box className={categoryCardClasses.allP}>
        <Typography
          className={`${categoryCardClasses.allPText} ${fontClassName.className}`}
        >
          {t('allProducts')}
        </Typography>
      </Box>
    ) : (
      <>
        <CardMedia
          component="img"
          className={categoryCardClasses.cardMedia}
          image={imgSrc ?? PRODUCT_IMAGE_FALLBACK}
          alt="Xmobile"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            const el = e.currentTarget;
            el.onerror = null;
            el.src = PRODUCT_IMAGE_FALLBACK;
          }}
        />
        <Box className={categoryCardClasses.gradient} />
        <Typography
          className={`${categoryCardClasses.name} ${fontClassName.className}`}
        >
          {parseName(name, router.locale ?? 'tk')}
        </Typography>
      </>
    );

  if (href) {
    return (
      <Card
        component={Link}
        href={href}
        className={categoryCardClasses.card[platform]}
        onClick={onClick}
        elevation={0}
      >
        {content}
      </Card>
    );
  }

  return (
    <Card
      className={categoryCardClasses.card[platform]}
      onClick={onClick}
      elevation={0}
    >
      {content}
    </Card>
  );
}
