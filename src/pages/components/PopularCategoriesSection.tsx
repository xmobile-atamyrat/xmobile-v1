import {
  ALL_PRODUCTS_CATEGORY_CARD,
  DEFAULT_LOCALE,
} from '@/pages/lib/constants';
import {
  getCategoryMediaUrl,
  PRODUCT_IMAGE_FALLBACK,
} from '@/pages/lib/mediaUrls';
import { buildPopularCategoriesSectionModel } from '@/pages/lib/popularCategoriesLayout';
import { ExtendedCategory } from '@/pages/lib/types';
import { parseName } from '@/pages/lib/utils';
import { popularCategoriesSectionClasses as cls } from '@/styles/classMaps/components/popularCategoriesSection';
import { interClassname } from '@/styles/theme';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useCallback, useMemo } from 'react';

interface CategoryImageProps {
  initialImgUrl?: string | null;
  className: string;
}

function CategoryImage({ initialImgUrl, className }: CategoryImageProps) {
  const imgSrc = useMemo(() => {
    if (
      initialImgUrl == null ||
      initialImgUrl === '' ||
      initialImgUrl === ALL_PRODUCTS_CATEGORY_CARD
    ) {
      return PRODUCT_IMAGE_FALLBACK;
    }
    if (initialImgUrl.startsWith('http')) return initialImgUrl;
    return getCategoryMediaUrl(initialImgUrl) ?? PRODUCT_IMAGE_FALLBACK;
  }, [initialImgUrl]);

  return (
    <img
      src={imgSrc}
      alt=""
      className={className}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        const el = e.currentTarget;
        el.onerror = null;
        el.src = PRODUCT_IMAGE_FALLBACK;
      }}
    />
  );
}

interface PopularCategoriesSectionProps {
  categories: ExtendedCategory[];
}

export default function PopularCategoriesSection({
  categories,
}: PopularCategoriesSectionProps) {
  const t = useTranslations();
  const router = useRouter();
  const locale = router.locale ?? DEFAULT_LOCALE;

  const handleNavigate = useCallback(
    (categorySlug: string) => {
      router.push(`/category/${categorySlug}`);
    },
    [router],
  );

  const handleMore = useCallback(() => {
    router.push('/category');
  }, [router]);

  const { shouldRender, fullWidthItems, showFullWidthMore } =
    buildPopularCategoriesSectionModel(categories);

  if (!shouldRender) return null;

  return (
    <Box className={cls.section}>
      <Typography className={`${interClassname.className} ${cls.sectionTitle}`}>
        {t('popularCategories')}
      </Typography>

      <Box className={cls.grid}>
        {fullWidthItems.map((cat) => (
          <Box
            key={cat.id}
            className={cls.fullWidthCard}
            onClick={() => handleNavigate(cat.slug)}
          >
            <Box className={cls.fullWidthImageBox}>
              <CategoryImage
                initialImgUrl={cat.imgUrl}
                className={cls.fullWidthImage}
              />
            </Box>
            <Typography
              className={`${interClassname.className} ${cls.fullWidthName}`}
            >
              {parseName(cat.name, locale)}
            </Typography>
            <ChevronRightIcon className={cls.chevron} />
          </Box>
        ))}

        {showFullWidthMore && (
          <Box className={cls.fullWidthMoreCard} onClick={handleMore}>
            <Box className={cls.moreDotsBox}>
              <Typography className={cls.moreDotsText}>···</Typography>
            </Box>
            <Typography
              className={`${interClassname.className} ${cls.fullWidthName}`}
              sx={{ color: 'text.secondary' }}
            >
              {t('moreCategories')}
            </Typography>
            <ChevronRightIcon className={cls.chevron} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
