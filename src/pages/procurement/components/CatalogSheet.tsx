import DeleteDialog from '@/pages/components/DeleteDialog';
import CatalogItemActions from '@/pages/procurement/components/catalog/CatalogItemActions';
import CatalogRow from '@/pages/procurement/components/catalog/CatalogRow';
import CatalogSearchField from '@/pages/procurement/components/catalog/CatalogSearchField';
import NameDialog from '@/pages/procurement/components/NameDialog';
import ProcurementSheet from '@/pages/procurement/components/ProcurementSheet';
import {
  CatalogItem,
  useProcurement,
} from '@/pages/procurement/lib/ProcurementContext';
import { ProductsSuppliersType } from '@/pages/procurement/lib/types';
import { procurementClasses as c } from '@/styles/classMaps/procurement';
import { catalogClasses as cc } from '@/styles/classMaps/procurement/catalog';
import { fontClassName } from '@/styles/theme';
import { Box, ButtonBase, CircularProgress, Typography } from '@mui/material';
import { Package, Plus, SearchX, Store } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

/** A search that never answers (network error) stops spinning after this. */
const SEARCH_TIMEOUT_MS = 10000;

const normalize = (name: string) => name.trim().toLocaleLowerCase();

function CatalogSheetContent({ type }: { type: ProductsSuppliersType }) {
  const t = useTranslations();
  const {
    closeCatalog,
    searchedItems,
    searchCatalog,
    createCatalogItem,
    addCatalogItemToOrder,
    editCatalogItem,
    deleteCatalogItem,
    selectedProducts,
    selectedSuppliers,
    selectedHistory,
  } = useProcurement();
  const isSupplier = type === 'supplier';

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  /** Ids the user tried to add in this sheet; counted once they're in the order. */
  const [triedIds, setTriedIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState<{
    item: CatalogItem;
    anchor: HTMLElement;
  }>();
  const [renaming, setRenaming] = useState<CatalogItem>();
  const [deleting, setDeleting] = useState<CatalogItem>();

  const trimmed = query.trim();

  // Any new result list (search answer, create, rename, delete) ends the wait.
  useEffect(() => {
    setSearching(false);
  }, [searchedItems]);

  useEffect(() => {
    if (!searching) return undefined;
    const timer = setTimeout(() => setSearching(false), SEARCH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [searching, query]);

  const inOrderIds = useMemo(
    () =>
      new Set(
        (isSupplier ? selectedSuppliers : selectedProducts).map(
          (item) => item.id,
        ),
      ),
    [isSupplier, selectedProducts, selectedSuppliers],
  );
  const addedCount = triedIds.filter((id) => inOrderIds.has(id)).length;
  const hasExactMatch = searchedItems.some(
    (item) => normalize(item.name) === normalize(trimmed),
  );
  const showResults = trimmed !== '';
  const showCreate = showResults && !searching && !hasExactMatch;

  const changeQuery = (value: string) => {
    setQuery(value);
    const keyword = value.trim();
    // An empty keyword would return the whole base; show the hint instead.
    if (keyword === '') {
      setSearching(false);
      return;
    }
    setSearching(true);
    searchCatalog(keyword);
  };

  const add = async (item: CatalogItem) => {
    if (pendingIds.includes(item.id) || inOrderIds.has(item.id)) return;
    setPendingIds((ids) => [...ids, item.id]);
    setTriedIds((ids) => (ids.includes(item.id) ? ids : [...ids, item.id]));
    try {
      await addCatalogItemToOrder(item);
    } finally {
      setPendingIds((ids) => ids.filter((id) => id !== item.id));
    }
  };

  const createAndAdd = async () => {
    if (creating || trimmed === '') return;
    setCreating(true);
    try {
      const created = await createCatalogItem(trimmed);
      if (created) await add(created);
    } finally {
      setCreating(false);
    }
  };

  const EmptyIcon = isSupplier ? Store : Package;
  let body;
  if (!showResults) {
    body = (
      <Box className={cc.state}>
        <span className={cc.stateIcon}>
          <EmptyIcon className="w-6 h-6" />
        </span>
        <Typography className={`text-[14px] ${fontClassName.className}`}>
          {t(
            isSupplier
              ? 'procurementCatalogHintSupplier'
              : 'procurementCatalogHintProduct',
          )}
        </Typography>
      </Box>
    );
  } else {
    body = (
      <>
        {showCreate && (
          <ButtonBase
            disableRipple
            disabled={creating}
            onClick={createAndAdd}
            className={`${cc.createRow} ${fontClassName.className}`}
          >
            <span className={cc.createIcon}>
              {creating ? (
                <CircularProgress size={18} sx={{ color: '#fff' }} />
              ) : (
                <Plus className="w-5 h-5" />
              )}
            </span>
            <span className="flex-1 min-w-0">
              <span className={`block ${cc.createTitle}`}>
                {t('procurementCreateAndAdd', { name: trimmed })}
              </span>
              <span className={`block ${cc.createHint}`}>
                {t('procurementCreateAndAddHint')}
              </span>
            </span>
          </ButtonBase>
        )}
        {searchedItems.length > 0 && (
          <ul className={cc.list} aria-busy={searching}>
            {searchedItems.map((item) => (
              <CatalogRow
                key={item.id}
                item={item}
                inOrder={inOrderIds.has(item.id)}
                pending={pendingIds.includes(item.id)}
                onAdd={add}
                onMore={(target, anchor) => setMenu({ item: target, anchor })}
              />
            ))}
          </ul>
        )}
        {searchedItems.length === 0 && !searching && (
          <Box className={cc.nothing}>
            <SearchX className="w-4 h-4 flex-none" aria-hidden />
            <Typography className={`text-[13px] ${fontClassName.className}`}>
              {t('procurementCatalogNothingFound')}
            </Typography>
          </Box>
        )}
      </>
    );
  }

  const renameLabel = isSupplier
    ? t('procurementEditSupplier')
    : t('procurementRename');

  return (
    <ProcurementSheet
      fullHeight
      onClose={closeCatalog}
      title={isSupplier ? t('addSuppliers') : t('addProducts')}
      subtitle={selectedHistory?.name}
      data-testid="catalog-sheet"
      footer={
        <ButtonBase
          disableRipple
          onClick={closeCatalog}
          className={`${c.btnPrimary} flex-1 ${fontClassName.className}`}
        >
          {t('procurementCatalogDone', { count: addedCount })}
        </ButtonBase>
      }
    >
      <CatalogSearchField
        value={query}
        onChange={changeQuery}
        searching={searching}
        placeholder={
          isSupplier
            ? t('procurementSearchSuppliers')
            : t('procurementSearchProducts')
        }
      />
      {body}

      <CatalogItemActions
        item={menu?.item}
        anchorEl={menu?.anchor ?? null}
        renameLabel={renameLabel}
        onClose={() => setMenu(undefined)}
        onRename={(item) => {
          setMenu(undefined);
          setRenaming(item);
        }}
        onDelete={(item) => {
          setMenu(undefined);
          setDeleting(item);
        }}
      />

      {renaming && (
        <NameDialog
          title={renameLabel}
          initialValue={renaming.name}
          label={isSupplier ? t('name') : undefined}
          secondField={
            isSupplier && 'description' in renaming
              ? {
                  label: t('procurementSupplierNote'),
                  initialValue: renaming.description ?? '',
                  placeholder: t('procurementSupplierNotePlaceholder'),
                }
              : undefined
          }
          onClose={() => setRenaming(undefined)}
          onSubmit={(name, description) =>
            editCatalogItem({
              id: renaming.id,
              name,
              ...(isSupplier ? { description } : {}),
            })
          }
        />
      )}

      {deleting && (
        <DeleteDialog
          title={`${t('procurementDeleteFromBase')}?`}
          description={t('confirmProductSupplierDelete')}
          handleClose={() => setDeleting(undefined)}
          handleDelete={async () => {
            await deleteCatalogItem(deleting.id);
            setDeleting(undefined);
          }}
        />
      )}
    </ProcurementSheet>
  );
}

/**
 * Search/add/edit/delete in the procurement product or supplier base; opened
 * by useProcurement().openCatalog(type). Several items can be added without
 * closing; when the typed name isn't in the base, one tap creates it and adds
 * it to the order. Reads everything from useProcurement(); takes no props.
 */
export default function CatalogSheet(): JSX.Element | null {
  const { catalogType } = useProcurement();
  if (catalogType == null) return null;
  // Keyed so switching products <-> suppliers starts from a clean search.
  return <CatalogSheetContent key={catalogType} type={catalogType} />;
}
