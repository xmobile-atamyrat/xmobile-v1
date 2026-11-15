import {
  ALL_PRODUCTS_CATEGORY_CARD,
  DEFAULT_LOCALE,
} from '@/pages/lib/constants';
import {
  getCategoryMediaUrl,
  PRODUCT_IMAGE_FALLBACK,
} from '@/pages/lib/mediaUrls';
import { useProductContext } from '@/pages/lib/ProductContext';
import { buildPopularCategoriesSectionModel } from '@/pages/lib/popularCategoriesLayout';
import { ExtendedCategory } from '@/pages/lib/types';
import { parseName } from '@/pages/lib/utils';
import { popularCategoriesSectionClasses as cls } from '@/styles/classMaps/components/popularCategoriesSection';
import { fontClassName } from '@/styles/theme';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

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
  const { setProducts } = useProductContext();
  const locale = router.locale ?? DEFAULT_LOCALE;
  const [expanded, setExpanded] = useState(false);

  const handleNavigate = useCallback(
    (category: ExtendedCategory) => {
      if (
        category.successorCategories == null ||
        category.successorCategories.length === 0
      ) {
        setProducts([]);
        router.push(`/product-category/${category.slug}`);
        return;
      }
      router.push(`/category/${category.slug}`);
    },
    [router, setProducts],
  );

  const { shouldRender, primary, rest } =
    buildPopularCategoriesSectionModel(categories);

  if (!shouldRender) return null;

  const visible = expanded ? [...primary, ...rest] : primary;
  const ToggleIcon = expanded ? ChevronUp : ChevronDown;

  return (
    <Box className={cls.section}>
      <Typography className={`${fontClassName.className} ${cls.sectionTitle}`}>
        {t('categories')}
      </Typography>

      <Box className={cls.grid}>
        {visible.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={cls.tile}
            onClick={() => handleNavigate(cat)}
          >
            <CategoryImage initialImgUrl={cat.imgUrl} className={cls.image} />
            <span className={`${fontClassName.className} ${cls.name}`}>
              <span className={cls.nameText}>
                {parseName(cat.name, locale)}
              </span>
              <ChevronRight size={14} className={cls.chevron} />
            </span>
          </button>
        ))}
      </Box>

      {rest.length > 0 && (
        <button
          type="button"
          className={`${fontClassName.className} ${cls.toggle}`}
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? t('showLess') : t('moreCategories')}
          <ToggleIcon size={16} />
        </button>
      )}
    </Box>
  );
}
