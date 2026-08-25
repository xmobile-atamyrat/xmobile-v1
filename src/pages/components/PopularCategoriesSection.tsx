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
import { fontClassName } from '@/styles/theme';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useCallback, useMemo } from 'react';

interface CategoryImageProps {
  initialImgUrl?: string | null;
  className: string;
}

export function CategoryImage({
  initialImgUrl,
  className,
}: CategoryImageProps) {
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
      <Box className={cls.header}>
        <Typography
          className={`${fontClassName.className} ${cls.sectionTitle}`}
        >
          {t('popularCategories')}
        </Typography>
        {showFullWidthMore && (
          <Typography
            className={`${fontClassName.className} ${cls.seeAll}`}
            onClick={handleMore}
          >
            {t('moreCategories')}
          </Typography>
        )}
      </Box>

      <Box className={cls.rail}>
        {fullWidthItems.map((cat) => (
          <Box
            key={cat.id}
            className={cls.item}
            onClick={() => handleNavigate(cat.slug)}
          >
            <Box className={cls.imageBox}>
              <CategoryImage initialImgUrl={cat.imgUrl} className={cls.image} />
            </Box>
            <Typography className={`${fontClassName.className} ${cls.name}`}>
              {parseName(cat.name, locale)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
