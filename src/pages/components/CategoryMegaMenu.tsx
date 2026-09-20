import { CategoryImage } from '@/pages/components/PopularCategoriesSection';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import {
  DEFAULT_LOCALE,
  HIGHEST_LEVEL_CATEGORY_ID,
} from '@/pages/lib/constants';
import {
  DeleteCategoriesProps,
  EditCategoriesProps,
  ExtendedCategory,
} from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import { categoryMegaMenuClasses as cls } from '@/styles/classMaps/components/categoryMegaMenu';
import { fontClassName } from '@/styles/theme';
import { Box, Menu, MenuItem, Typography } from '@mui/material';
import {
  ArrowRight,
  ChevronRight,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';

const subsOf = (category?: ExtendedCategory | null): ExtendedCategory[] =>
  category?.successorCategories ?? [];

/** Root category that owns `targetId` anywhere in its subtree. */
const rootContaining = (
  categories: ExtendedCategory[],
  targetId?: string,
): ExtendedCategory | undefined => {
  if (!targetId) return undefined;
  const owns = (category: ExtendedCategory): boolean =>
    category.id === targetId || subsOf(category).some(owns);
  return categories.find(owns);
};

interface Group {
  id: string;
  heading: ExtendedCategory;
  items: ExtendedCategory[];
}

/**
 * The mockup's four fixed groups (By brand / By price / Features / Accessories)
 * are invented facets; our tree is real and only 2-3 levels deep, so the groups
 * are the category's own children: a child with children of its own becomes a
 * heading over them, and the leaf children are listed together under the open
 * category's own name.
 */
const buildGroups = (category?: ExtendedCategory | null): Group[] => {
  if (category == null) return [];
  const children = subsOf(category);
  const leaves = children.filter((child) => subsOf(child).length === 0);
  const groups: Group[] = children
    .filter((child) => subsOf(child).length > 0)
    .map((child) => ({ id: child.id, heading: child, items: subsOf(child) }));

  if (leaves.length > 0) {
    groups.unshift({ id: category.id, heading: category, items: leaves });
  }
  return groups;
};

interface AdminActionsProps {
  category: ExtendedCategory;
  setEditCategoriesModal?: Dispatch<SetStateAction<EditCategoriesProps>>;
  setDeleteCategoriesModal?: Dispatch<SetStateAction<DeleteCategoriesProps>>;
}

/** Edit/delete affordance the old CollapsableBase row carried, kept 1:1. */
function AdminActions({
  category,
  setEditCategoriesModal,
  setDeleteCategoriesModal,
}: AdminActionsProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const t = useTranslations();

  if (setEditCategoriesModal == null || setDeleteCategoriesModal == null) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label={t('edit')}
        className={cls.adminButton}
        onClick={(event) => {
          event.stopPropagation();
          setAnchorEl(event.currentTarget);
        }}
      >
        <MoreVertical className={cls.adminIcon} />
      </button>
      <Menu
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        onClick={(event) => event.stopPropagation()}
      >
        <MenuItem
          className={`${cls.adminMenuItem} ${fontClassName.className}`}
          onClick={() => {
            setAnchorEl(null);
            setEditCategoriesModal({
              open: true,
              dialogType: 'edit',
              categoryId: category.id,
              categoryName: category.name,
              imageUrl: category.imgUrl ?? undefined,
              popular: category.popular ?? false,
            });
          }}
        >
          <Pencil className="w-4 h-4 text-navy" />
          {t('edit')}
        </MenuItem>
        <MenuItem
          className={`${cls.adminMenuItem} ${fontClassName.className}`}
          onClick={() => {
            setAnchorEl(null);
            setDeleteCategoriesModal({ open: true, categoryId: category.id });
          }}
        >
          <Trash2 className="w-4 h-4 text-red" />
          {t('delete')}
        </MenuItem>
      </Menu>
    </>
  );
}

interface CategoryMegaMenuProps {
  categories: ExtendedCategory[];
  open: boolean;
  onClose: () => void;
  onNavigate: (category: ExtendedCategory) => void;
  setEditCategoriesModal?: Dispatch<SetStateAction<EditCategoriesProps>>;
  setDeleteCategoriesModal?: Dispatch<SetStateAction<DeleteCategoriesProps>>;
}

/**
 * Web "All Categories" mega menu (spec 2231-2290). Replaces the old nested
 * hover-flyout `Menu` tree (Drawer/Collapsable/CollapsableBase): one panel
 * under the category bar, root categories in the left rail, the open root's
 * subcategories in the body.
 */
export default function CategoryMegaMenu({
  categories,
  open,
  onClose,
  onNavigate,
  setEditCategoriesModal,
  setDeleteCategoriesModal,
}: CategoryMegaMenuProps) {
  const t = useTranslations();
  const router = useRouter();
  const locale = router.locale ?? DEFAULT_LOCALE;
  const { selectedCategoryId, setSelectedCategoryId } = useCategoryContext();
  const { user } = useUserContext();
  const isAdmin = ['SUPERUSER', 'ADMIN'].includes(user?.grade);
  // null = "nothing hovered yet", which falls back to the category the current
  // route is under, then to the first root.
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Reopening the menu should start from the current route again, not from
  // whatever was hovered last time.
  useEffect(() => {
    if (!open) setHoveredId(null);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const active = useMemo(() => {
    if (categories.length === 0) return undefined;
    return (
      categories.find((category) => category.id === hoveredId) ??
      rootContaining(categories, selectedCategoryId) ??
      categories[0]
    );
  }, [categories, hoveredId, selectedCategoryId]);

  const groups = useMemo(() => buildGroups(active), [active]);

  if (!open || categories.length === 0) return null;

  const go = (category: ExtendedCategory) => {
    onClose();
    onNavigate(category);
  };

  return (
    <>
      <Box className={cls.overlay} onClick={onClose} aria-hidden />
      <Box className={`${cls.panel} ${fontClassName.className}`}>
        <Box component="nav" className={cls.rail}>
          {categories.map((category) => {
            const isActive = category.id === active?.id;
            return (
              <Box
                key={category.id}
                className={`${cls.railRow} ${
                  isActive ? cls.railRowActive : cls.railRowIdle
                }`}
                onMouseEnter={() => setHoveredId(category.id)}
              >
                <button
                  type="button"
                  className={cls.railButton}
                  onFocus={() => setHoveredId(category.id)}
                  onClick={() => go(category)}
                >
                  <Box className={cls.railThumbBox}>
                    <CategoryImage
                      initialImgUrl={category.imgUrl}
                      className={cls.railThumb}
                    />
                  </Box>
                  <span
                    className={`${cls.railLabel} ${
                      isActive ? cls.railLabelActive : cls.railLabelIdle
                    }`}
                  >
                    {parseName(category.name, locale)}
                  </span>
                </button>
                {isAdmin && (
                  <AdminActions
                    category={category}
                    setEditCategoriesModal={setEditCategoriesModal}
                    setDeleteCategoriesModal={setDeleteCategoriesModal}
                  />
                )}
                {subsOf(category).length > 0 && (
                  <ChevronRight
                    className={`${cls.railChevron} ${
                      isActive ? cls.railChevronActive : cls.railChevronIdle
                    }`}
                  />
                )}
              </Box>
            );
          })}
          {isAdmin && setEditCategoriesModal != null && (
            <button
              type="button"
              className={cls.railAdd}
              onClick={() => {
                setSelectedCategoryId(HIGHEST_LEVEL_CATEGORY_ID);
                setEditCategoriesModal({ open: true, dialogType: 'add' });
                onClose();
              }}
            >
              <Plus className="w-[18px] h-[18px]" />
              {t('addNewCategory')}
            </button>
          )}
        </Box>

        <Box className={cls.content}>
          <Box className={cls.groups}>
            {groups.map((group) => (
              <Box key={group.id} className={cls.group}>
                <Box className={cls.groupHeadingRow}>
                  <button
                    type="button"
                    className={cls.groupHeading}
                    onClick={() => go(group.heading)}
                  >
                    {parseName(group.heading.name, locale)}
                  </button>
                  {isAdmin && group.heading.id !== active?.id && (
                    <AdminActions
                      category={group.heading}
                      setEditCategoriesModal={setEditCategoriesModal}
                      setDeleteCategoriesModal={setDeleteCategoriesModal}
                    />
                  )}
                </Box>
                <Box className={cls.groupList}>
                  {group.items.map((item) => (
                    <Box key={item.id} className={cls.groupItemRow}>
                      <button
                        type="button"
                        className={cls.groupItem}
                        onClick={() => go(item)}
                      >
                        {parseName(item.name, locale)}
                      </button>
                      {isAdmin && (
                        <AdminActions
                          category={item}
                          setEditCategoriesModal={setEditCategoriesModal}
                          setDeleteCategoriesModal={setDeleteCategoriesModal}
                        />
                      )}
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
            {groups.length === 0 && active != null && (
              <Box className={cls.group}>
                <Typography className={cls.emptyHeading}>
                  {parseName(active.name, locale)}
                </Typography>
                <button
                  type="button"
                  className={cls.emptyLink}
                  onClick={() => go(active)}
                >
                  {t('allProducts')}
                  <ArrowRight className={cls.promoCtaIcon} />
                </button>
              </Box>
            )}
          </Box>

          {active != null && (
            <Box className={cls.promo}>
              <CategoryImage
                initialImgUrl={active.imgUrl}
                className={cls.promoImage}
              />
              <Box className={cls.promoBody}>
                <span className={cls.promoEyebrow}>{t('category')}</span>
                <span className={cls.promoTitle}>
                  {parseName(active.name, locale)}
                </span>
                <span className={cls.promoMeta}>
                  {subsOf(active).length > 0
                    ? `${subsOf(active).length} ${t('categories')}`
                    : t('allProducts')}
                </span>
                <button
                  type="button"
                  className={cls.promoCta}
                  onClick={() => go(active)}
                >
                  {t('viewAll')}
                  <ArrowRight className={cls.promoCtaIcon} />
                </button>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </>
  );
}
