import BASE_URL from '@/lib/ApiEndpoints';
import {
  ALL_PRODUCTS_CATEGORY_CARD,
  DEFAULT_LOCALE,
} from '@/pages/lib/constants';
import { ExtendedCategory } from '@/pages/lib/types';
import { blobToBase64, parseName } from '@/pages/lib/utils';
import { popularCategoriesSectionClasses as cls } from '@/styles/classMaps/components/popularCategoriesSection';
import { interClassname } from '@/styles/theme';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

const MAX_CATEGORIES = 7;

interface CategoryImageProps {
  initialImgUrl?: string | null;
  className: string;
}

function CategoryImage({ initialImgUrl, className }: CategoryImageProps) {
  const [imgUrl, setImgUrl] = useState<string>(
    '/logo/xmobile-original-logo.jpeg',
  );

  useEffect(() => {
    if (
      initialImgUrl == null ||
      initialImgUrl === '' ||
      initialImgUrl === ALL_PRODUCTS_CATEGORY_CARD
    ) {
      return undefined;
    }

    let cancelled = false;

    (async () => {
      if (initialImgUrl.startsWith('http')) {
        if (!cancelled) setImgUrl(initialImgUrl);
        return;
      }
      const resp = await fetch(
        `${BASE_URL}/api/localImage?imgUrl=${initialImgUrl}`,
      );
      if (cancelled || !resp.ok) return;
      const blob = await resp.blob();
      const base64 = await blobToBase64(blob);
      if (!cancelled) setImgUrl(base64);
    })();

    return () => {
      cancelled = true;
    };
  }, [initialImgUrl]);

  return <img src={imgUrl} alt="" className={className} />;
}

interface PopularCategoriesSectionProps {
  categories: ExtendedCategory[];
}

type HalfPair = {
  left: ExtendedCategory;
  right: ExtendedCategory | 'more';
};

export default function PopularCategoriesSection({
  categories,
}: PopularCategoriesSectionProps) {
  const t = useTranslations();
  const router = useRouter();
  const locale = router.locale ?? DEFAULT_LOCALE;

  const handleNavigate = useCallback(
    (categoryId: string) => {
      router.push(`/category/${categoryId}`);
    },
    [router],
  );

  const handleMore = useCallback(() => {
    router.push('/category');
  }, [router]);

  const topLevel = categories.filter(
    (cat) => cat.predecessorId == null && cat.deletedAt == null,
  );

  const popularOnes = topLevel.filter((cat) => cat.popular);
  const regularOnes = topLevel.filter((cat) => !cat.popular);

  const displayCats = [...popularOnes, ...regularOnes].slice(0, MAX_CATEGORIES);

  if (displayCats.length === 0) return null;

  const fullWidthItems = displayCats.filter((cat) => cat.popular);
  const halfWidthItems = displayCats.filter((cat) => !cat.popular);

  // Ensure (usedCount + 1 for 'more') is always even → usedCount must be odd.
  // If halfWidthItems.length is even (and > 0), drop the last to make it odd.
  const usedHalfWidthItems =
    halfWidthItems.length > 0 && halfWidthItems.length % 2 === 0
      ? halfWidthItems.slice(0, halfWidthItems.length - 1)
      : halfWidthItems;

  const halfPairs: HalfPair[] = [];
  for (let i = 0; i + 1 < usedHalfWidthItems.length; i += 2) {
    halfPairs.push({
      left: usedHalfWidthItems[i],
      right: usedHalfWidthItems[i + 1],
    });
  }
  // Last item (always a real category) paired with 'more'
  if (usedHalfWidthItems.length > 0) {
    halfPairs.push({
      left: usedHalfWidthItems[usedHalfWidthItems.length - 1],
      right: 'more',
    });
  }

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
            onClick={() => handleNavigate(cat.id)}
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

        {halfPairs.map((pair) => {
          const { left, right } = pair;
          const rowKey =
            right === 'more' ? `${left.id}-more` : `${left.id}-${right.id}`;
          return (
            <Box key={rowKey} className={cls.halfWidthRow}>
              <Box
                className={cls.halfWidthCard}
                onClick={() => handleNavigate(left.id)}
              >
                <Box className={cls.halfWidthImageBox}>
                  <CategoryImage
                    initialImgUrl={left.imgUrl}
                    className={cls.halfWidthImage}
                  />
                </Box>
                <Typography
                  className={`${interClassname.className} ${cls.halfWidthName}`}
                >
                  {parseName(left.name, locale)}
                </Typography>
                <ChevronRightIcon className={cls.halfWidthChevron} />
              </Box>

              {right === 'more' ? (
                <Box className={cls.moreTile} onClick={handleMore}>
                  <Box className={cls.moreDotsBox}>
                    <Typography className={cls.moreDotsText}>···</Typography>
                  </Box>
                  <Typography
                    className={`${interClassname.className} ${cls.moreTileText}`}
                  >
                    {t('moreCategories')}
                  </Typography>
                </Box>
              ) : (
                <Box
                  className={cls.halfWidthCard}
                  onClick={() => handleNavigate(right.id)}
                >
                  <Box className={cls.halfWidthImageBox}>
                    <CategoryImage
                      initialImgUrl={right.imgUrl}
                      className={cls.halfWidthImage}
                    />
                  </Box>
                  <Typography
                    className={`${interClassname.className} ${cls.halfWidthName}`}
                  >
                    {parseName(right.name, locale)}
                  </Typography>
                  <ChevronRightIcon className={cls.halfWidthChevron} />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
