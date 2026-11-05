import { verifyToken } from '@/pages/api/utils/authMiddleware';
import { REFRESH_SECRET } from '@/pages/api/utils/tokenUtils';
import Layout from '@/pages/components/Layout';
import { AUTH_REFRESH_COOKIE_NAME } from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import CatalogSheet from '@/pages/procurement/components/CatalogSheet';
import OrdersSheet from '@/pages/procurement/components/OrdersSheet';
import PricesPanel from '@/pages/procurement/components/PricesPanel';
import ProcurementHeader from '@/pages/procurement/components/ProcurementHeader';
import ProductsPanel from '@/pages/procurement/components/ProductsPanel';
import RateCard from '@/pages/procurement/components/RateCard';
import SuppliersPanel from '@/pages/procurement/components/SuppliersPanel';
import WorkflowPanel from '@/pages/procurement/components/WorkflowPanel';
import {
  ProcurementProvider,
  useProcurement,
} from '@/pages/procurement/lib/ProcurementContext';
import { procurementClasses as c } from '@/styles/classMaps/procurement';
import { procurementShellClasses as s } from '@/styles/classMaps/procurement/shell';
import { snackbarClasses } from '@/styles/classMaps/components/snackbar';
import { fontClassName } from '@/styles/theme';
import {
  Box,
  ButtonBase,
  CircularProgress,
  Snackbar,
  Typography,
} from '@mui/material';
import { UserRole } from '@prisma/client';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Info,
  Plus,
  XCircle,
} from 'lucide-react';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

// Superuser-only page: check the refresh cookie on the server so other users
// are redirected before any procurement UI (or request) reaches them.
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const home = {
    redirect: { destination: `/${ctx.locale || 'ru'}/`, permanent: false },
  };
  const refreshToken = ctx.req.cookies[AUTH_REFRESH_COOKIE_NAME];
  if (!refreshToken) return home;

  try {
    const decoded = await verifyToken(refreshToken, REFRESH_SECRET);
    if (decoded.grade !== UserRole.SUPERUSER) return home;
  } catch {
    return home;
  }

  return {
    props: {
      messages: (await import(`../../i18n/${ctx.locale}.json`)).default,
    },
  };
};

export type ProcurementTab = 'products' | 'suppliers' | 'prices';

const TABS: ProcurementTab[] = ['products', 'suppliers', 'prices'];

const parseTab = (value: unknown): ProcurementTab =>
  TABS.includes(value as ProcurementTab)
    ? (value as ProcurementTab)
    : 'products';

const toastIcon = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

function LoadingSkeleton() {
  const platform = usePlatform();
  const block = (height: number, key?: string) => (
    <Box key={key} className={s.skeleton} sx={{ height }} />
  );
  const pills = (
    <Box className="flex gap-2">
      {[88, 108, 72].map((width) => (
        <Box
          key={width}
          className={`${s.skeletonBar} animate-pulse bg-white`}
          sx={{ width, height: 34 }}
        />
      ))}
    </Box>
  );

  if (platform === 'mobile') {
    return (
      <Box className={c.content.mobile} aria-busy data-testid="loading">
        {block(96)}
        {block(132)}
        {pills}
        {block(280)}
      </Box>
    );
  }
  return (
    <Box className={s.grid} aria-busy data-testid="loading">
      <Box className={s.aside}>
        {block(110)}
        {block(220)}
      </Box>
      <Box className={s.main}>
        {pills}
        {block(420)}
      </Box>
    </Box>
  );
}

function NoOrderState() {
  const t = useTranslations();
  const platform = usePlatform();
  const { historyList, setNewOrderDialogOpen, setOrdersSheetOpen } =
    useProcurement();
  const font = fontClassName.className;
  const hasOrders = historyList.length > 0;

  return (
    <Box className={s.emptyCard[platform]} data-testid="procurement-no-order">
      <Box className={c.emptyIcon}>
        <ClipboardList size={26} />
      </Box>
      <Typography className={`${font} ${s.emptyTitle}`}>
        {hasOrders ? t('orderNotSelected') : t('procurementNoOrdersTitle')}
      </Typography>
      {!hasOrders && (
        <Typography className={`${font} ${s.emptyText}`}>
          {t('procurementNoOrdersHint')}
        </Typography>
      )}
      {hasOrders ? (
        <ButtonBase
          disableRipple
          onClick={() => setOrdersSheetOpen(true)}
          className={`${font} ${c.btnSoft} mt-2`}
        >
          <ClipboardList size={18} />
          {t('procurementSwitchOrder')}
        </ButtonBase>
      ) : (
        <ButtonBase
          disableRipple
          onClick={() => setNewOrderDialogOpen(true)}
          className={`${font} ${c.btnPrimary}`}
        >
          <Plus size={18} />
          {t('procurementCreateFirstOrder')}
        </ButtonBase>
      )}
    </Box>
  );
}

function ProcurementScreen() {
  const t = useTranslations();
  const router = useRouter();
  const platform = usePlatform();
  const {
    selectedHistory,
    selectedProducts,
    selectedSuppliers,
    initialLoading,
    loading,
    snackbarOpen,
    setSnackbarOpen,
    snackbarMessage,
  } = useProcurement();
  const [tab, setTab] = useState<ProcurementTab>(() =>
    parseTab(router.query.tab),
  );
  const font = fontClassName.className;

  useEffect(() => {
    setTab(parseTab(router.query.tab));
  }, [router.query.tab]);

  // Single owner of `?order=`: it follows the open order (select, create,
  // delete -> fallback) so refresh / a shared link reopens it rather than
  // the latest one; it is dropped once no order is open (last one deleted).
  const selectedId = selectedHistory?.id;
  useEffect(() => {
    if (initialLoading) return;
    const current = router.query.order;
    if (current === selectedId || (selectedId == null && current == null)) {
      return;
    }
    const query = { ...router.query };
    if (selectedId == null) delete query.order;
    else query.order = selectedId;
    router.replace({ pathname: router.pathname, query }, undefined, {
      shallow: true,
      scroll: false,
    });
    // Only the open order drives this; router.query is read fresh above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, initialLoading]);

  const selectTab = (next: ProcurementTab) => {
    setTab(next);
    const query = { ...router.query };
    if (next === 'products') delete query.tab;
    else query.tab = next;
    router.replace({ pathname: router.pathname, query }, undefined, {
      shallow: true,
      scroll: false,
    });
  };

  const tabs: { key: ProcurementTab; label: string; count?: number }[] = [
    { key: 'products', label: t('products'), count: selectedProducts.length },
    {
      key: 'suppliers',
      label: t('suppliers'),
      count: selectedSuppliers.length,
    },
    { key: 'prices', label: t('prices') },
  ];
  const ToastIcon = toastIcon[snackbarMessage?.severity ?? 'info'];

  const tabBar = (
    <Box className={c.pills} role="tablist">
      {tabs.map((item) => (
        <ButtonBase
          key={item.key}
          role="tab"
          aria-selected={tab === item.key}
          disableRipple
          onClick={() => selectTab(item.key)}
          className={`${font} ${c.pill} ${
            tab === item.key ? c.pillActive : c.pillIdle
          }`}
        >
          {item.label}
          {item.count != null && (
            <span className={c.pillCount}>{item.count}</span>
          )}
        </ButtonBase>
      ))}
    </Box>
  );
  const panel = (
    <Box role="tabpanel" className="flex flex-col gap-3 min-w-0">
      {tab === 'products' && <ProductsPanel />}
      {tab === 'suppliers' && <SuppliersPanel />}
      {tab === 'prices' && <PricesPanel />}
    </Box>
  );

  let body;
  if (initialLoading) {
    body = <LoadingSkeleton />;
  } else if (selectedHistory == null) {
    body = (
      <Box className={platform === 'mobile' ? c.content.mobile : 'w-full'}>
        <NoOrderState />
      </Box>
    );
  } else if (platform === 'mobile') {
    body = (
      <Box className={c.content.mobile}>
        <RateCard />
        <WorkflowPanel />
        {tabBar}
        {panel}
      </Box>
    );
  } else {
    // Rate + workflow first in the DOM: on top below lg, sticky right
    // column from lg (see shell.ts `grid`).
    body = (
      <Box className={s.grid}>
        <Box component="aside" className={s.aside}>
          <RateCard />
          <WorkflowPanel />
        </Box>
        <Box className={s.main}>
          {tabBar}
          {panel}
        </Box>
      </Box>
    );
  }

  return (
    <Box className={c.page[platform]}>
      <ProcurementHeader />
      {body}

      <CatalogSheet />
      <OrdersSheet />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={5000}
        // Mobile: top. Bottom sheets (and their text fields / footers) fill
        // the lower part of the screen, and many sheets are local to panels,
        // so a bottom toast would cover them. Full-height sheets stop at
        // 92dvh, which leaves the toast its own strip above them.
        anchorOrigin={{
          vertical: platform === 'mobile' ? 'top' : 'bottom',
          horizontal: 'center',
        }}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') setSnackbarOpen(false);
        }}
        sx={
          platform === 'mobile'
            ? {
                top: 'max(12px, env(safe-area-inset-top)) !important',
                left: '16px !important',
                right: '16px !important',
              }
            : undefined
        }
      >
        <Box className={snackbarClasses.pill} role="status">
          <ToastIcon
            size={18}
            className={
              snackbarClasses.icon[snackbarMessage?.severity ?? 'info']
            }
          />
          <Typography className={`${font} ${snackbarClasses.message}`}>
            {snackbarMessage?.message && t(snackbarMessage.message)}
          </Typography>
        </Box>
      </Snackbar>

      {loading && (
        <Box className={s.overlay} aria-busy aria-live="polite">
          <Box className={s.overlayBox}>
            <CircularProgress size={30} sx={{ color: '#20166E' }} />
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default function Procurement() {
  const router = useRouter();
  const platform = usePlatform();
  const { user } = useUserContext();

  // Fallback for a client-side session that changed after the server check.
  useEffect(() => {
    if (user != null && user.grade !== 'SUPERUSER') router.push('/');
  }, [user, router]);

  return (
    <Layout handleHeaderBackButton={() => router.push('/user')}>
      {/* The server already checked the role; show the skeleton while the
          client session restores instead of a blank page. */}
      {user == null && (
        <Box className={c.page[platform]}>
          <LoadingSkeleton />
        </Box>
      )}
      {user?.grade === 'SUPERUSER' && (
        <ProcurementProvider>
          <ProcurementScreen />
        </ProcurementProvider>
      )}
    </Layout>
  );
}
