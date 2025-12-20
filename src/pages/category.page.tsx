import CategoryCard from '@/pages/components/CategoryCard';
import Layout from '@/pages/components/Layout';
import SimpleBreadcrumbs from '@/pages/components/SimpleBreadcrumbs';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import {
  ALL_PRODUCTS_CATEGORY_CARD,
  HIGHEST_LEVEL_CATEGORY_ID,
  PAGENAME,
} from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { ExtendedCategory } from '@/pages/lib/types';
import { parseName } from '@/pages/lib/utils';
import { categoryPageClasses } from '@/styles/classMaps/category';
import { appbarClasses } from '@/styles/classMaps/components/appbar';
import { interClassname } from '@/styles/theme';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import { Box, IconButton, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

export default function Home() {
  const router = useRouter();
  const platform = usePlatform();
  const {
    setSelectedCategoryId,
    selectedCategoryId,
    categories: allCategories,
    stack,
    setStack,
    parentCategory,
    setParentCategory,
  } = useCategoryContext();
  const [localCategories, setLocalCategories] = useState<ExtendedCategory[]>(
    [],
  );
  const { setProducts } = useProductContext();
  const t = useTranslations();

  const handleHeaderBackButton = useCallback(() => {
    if (router.pathname.includes('product')) return;

    if (stack.length === 0) {
      setParentCategory(undefined);
      setLocalCategories(allCategories);
      return;
    }

    const currCat = stack.pop()?.[0];
    setStack([...stack]);
    setParentCategory(currCat);
    if (currCat != null) {
      setSelectedCategoryId(currCat.id);
      setLocalCategories(currCat.successorCategories ?? []);
    }
  }, [
    allCategories,
    setSelectedCategoryId,
    setStack,
    stack,
    router,
    setParentCategory,
  ]);

  useEffect(() => {
    if (allCategories == null || allCategories.length === 0) return;

    if (stack.length === 0) {
      setLocalCategories(allCategories);
    } else {
      const currCat = stack.pop()?.[0];
      setStack([...stack]);
      setParentCategory(currCat);
      if (currCat != null) {
        setSelectedCategoryId(currCat.id);
        setLocalCategories(currCat.successorCategories ?? []);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCategories]);

  // Reset categories to the highest level when the `home button` or `logo` is clicked on the index page.
  useEffect(() => {
    if (selectedCategoryId === HIGHEST_LEVEL_CATEGORY_ID) {
      setLocalCategories(allCategories);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryId]);

  return (
    <Layout
      handleHeaderBackButton={
        stack.length === 0 && parentCategory == null
          ? undefined
          : handleHeaderBackButton
      }
    >
      <Box className={categoryPageClasses.main[platform]}>
        {(stack.length > 0 || parentCategory != null) && (
          <SimpleBreadcrumbs
            onClick={(combo: [ExtendedCategory, string]) => {
              setStack([...stack.slice(0, stack.indexOf(combo) + 1)]);
              handleHeaderBackButton();
            }}
          />
        )}
        {!parentCategory ? (
          <Box className="w-full flex-col px-[24px] my-[36px]">
            <Typography
              className={`${interClassname.className} ${categoryPageClasses.categoriesText[platform]}`}
            >
              {t(PAGENAME.category[platform])}
            </Typography>
          </Box>
        ) : (
          <Box className="flex items-center w-full px-[24px] justify-between">
            <IconButton
              size="medium"
              edge="start"
              color="inherit"
              className={appbarClasses.backButton[platform]}
              aria-label="open drawer"
              onClick={() => {
                router.reload();
              }}
            >
              <ArrowBackIosIcon
                className={appbarClasses.arrowBackIos[platform]}
              />
            </IconButton>
            <Typography
              className={`${interClassname.className} ${categoryPageClasses.categoriesText[platform]}`}
            >
              {parseName(parentCategory.name, router.locale ?? 'ru')}
            </Typography>
            <IconButton
              size="medium"
              edge="start"
              color="inherit"
              className={`${appbarClasses.backButton[platform]} invisible`}
              aria-label="open drawer"
              onClick={() => {
                router.back();
              }}
            >
              <ArrowBackIosIcon
                className={appbarClasses.arrowBackIos[platform]}
              />
            </IconButton>
          </Box>
        )}

        <Box className={categoryPageClasses.card[platform]}>
          {parentCategory != null && (
            <CategoryCard
              id=""
              name=""
              initialImgUrl={ALL_PRODUCTS_CATEGORY_CARD}
              onClick={() => {
                if (parentCategory == null) return;
                setProducts([]);
                setStack((currStack) => [
                  ...currStack,
                  [parentCategory, parentCategory.name],
                ]);
                setSelectedCategoryId(parentCategory.id);
                setParentCategory(undefined);
                router.push('/product');
              }}
            />
          )}
          {localCategories?.map((category) => {
            const { imgUrl, name, id, successorCategories } = category;
            return (
              <CategoryCard
                id={id}
                name={name}
                initialImgUrl={imgUrl ?? undefined}
                key={id}
                onClick={() => {
                  if (parentCategory != null) {
                    setStack((prevStack) => [
                      ...prevStack,
                      [parentCategory, parentCategory.name],
                    ]);
                  }
                  setParentCategory(category);
                  setSelectedCategoryId(id);

                  if (
                    successorCategories == null ||
                    successorCategories.length === 0
                  ) {
                    setProducts([]);
                    router.push('/product');
                  } else {
                    setLocalCategories(successorCategories);
                  }
                }}
              />
            );
          })}
        </Box>
      </Box>
    </Layout>
  );
}
