import {
  ManagedUser,
  ManagedUserPage,
  ROLE_LABEL_KEYS,
  USER_ROLES,
} from '@/pages/lib/adminUsers';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import { colors, fontClassName, hairline, muted } from '@/styles/theme';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { UserRole } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

const SEARCH_DEBOUNCE_MS = 300;

type PendingChange = { user: ManagedUser; grade: UserRole };

type Props = {
  /** Called after a role changes, so the Activity tab's staff list reloads. */
  onRoleChanged: () => void;
};

const toQuery = (q: string, cursor?: string) => {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (cursor) params.set('cursor', cursor);
  const query = params.toString();
  return query ? `?${query}` : '';
};

export default function RolesPanel({ onRoleChanged }: Props) {
  const t = useTranslations();
  const { user: me, accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState<ManagedUserPage>({
    items: [],
    nextCursor: null,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pending, setPending] = useState<PendingChange | undefined>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Same reasoning as the Activity tab: a silently refreshed token must not
  // re-run the load and drop the pages fetched with "show more".
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(
    async (cursor?: string) => {
      const token = accessTokenRef.current;
      if (!token) return;
      requestId.current += 1;
      const id = requestId.current;
      setLoading(true);
      try {
        const response = await fetchWithCreds<ManagedUserPage>({
          accessToken: token,
          path: `/api/admin/users${toQuery(query, cursor)}`,
          method: 'GET',
        });
        if (id !== requestId.current) return;
        if (response.success && response.data) {
          const next = response.data;
          setPage((previous) => ({
            items: cursor ? [...previous.items, ...next.items] : next.items,
            nextCursor: next.nextCursor,
          }));
          setLoadError(false);
        } else {
          setLoadError(true);
        }
      } catch {
        if (id === requestId.current) setLoadError(true);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [fetchWithCreds, query],
  );

  useEffect(() => {
    load();
  }, [load]);

  const confirmChange = async () => {
    const token = accessTokenRef.current;
    if (!pending || !token) return;
    setSaving(true);
    try {
      const response = await fetchWithCreds<{ id: string; grade: UserRole }>({
        accessToken: token,
        path: '/api/admin/users',
        method: 'PATCH',
        body: { userId: pending.user.id, grade: pending.grade },
      });
      if (!response.success) {
        setSaveError(true);
        return;
      }
      // The row stays put even though the new role would sort it elsewhere, so
      // it doesn't jump away from under the cursor.
      setPage((previous) => ({
        ...previous,
        items: previous.items.map((item) =>
          item.id === pending.user.id
            ? { ...item, grade: pending.grade }
            : item,
        ),
      }));
      setSaveError(false);
      setPending(undefined);
      onRoleChanged();
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = (grade: UserRole) => t(ROLE_LABEL_KEYS[grade]);

  return (
    <Box className="flex flex-col gap-3">
      <TextField
        size="small"
        type="search"
        label={t('rolesSearch')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {loadError && <Alert severity="error">{t('rolesLoadError')}</Alert>}

      <Box
        component="ul"
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          backgroundColor: '#fff',
          borderRadius: '14px',
          border: `1px solid ${hairline}`,
        }}
      >
        {page.items.map((item) => {
          const isMe = item.id === me?.id;
          const select = (
            <TextField
              select
              size="small"
              label={t('rolesRole')}
              value={item.grade}
              disabled={isMe}
              onChange={(event) => {
                const grade = event.target.value as UserRole;
                if (grade !== item.grade) {
                  setSaveError(false);
                  setPending({ user: item, grade });
                }
              }}
              sx={{ minWidth: 170 }}
            >
              {USER_ROLES.map((grade) => (
                <MenuItem key={grade} value={grade}>
                  {roleLabel(grade)}
                </MenuItem>
              ))}
            </TextField>
          );
          return (
            <Box
              component="li"
              key={item.id}
              sx={{
                p: 2,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                '&:not(:last-child)': { borderBottom: `1px solid ${hairline}` },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  fontSize={15}
                  fontWeight={700}
                  className={fontClassName.className}
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {item.name.trim() || '—'}
                  {isMe && (
                    <Box
                      component="span"
                      sx={{ color: muted, fontWeight: 400 }}
                    >
                      {` (${t('rolesYou')})`}
                    </Box>
                  )}
                </Typography>
                <Typography
                  fontSize={13}
                  color={muted}
                  className={fontClassName.className}
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {[item.phoneNumber, item.email].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
              {isMe ? (
                <Tooltip title={t('rolesOwnRoleHint')}>
                  <span>{select}</span>
                </Tooltip>
              ) : (
                select
              )}
            </Box>
          );
        })}
        {!loading && !loadError && page.items.length === 0 && (
          <Box component="li" sx={{ p: 3, textAlign: 'center', color: muted }}>
            {t('rolesEmpty')}
          </Box>
        )}
      </Box>

      <Box className="flex flex-row justify-center">
        {loading ? (
          <CircularProgress size={24} />
        ) : (
          page.nextCursor && (
            <Button
              variant="outlined"
              onClick={() => page.nextCursor && load(page.nextCursor)}
              sx={{ textTransform: 'none', color: colors.main }}
            >
              {t('showMore')}
            </Button>
          )
        )}
      </Box>

      <Dialog
        open={pending != null}
        onClose={() => !saving && setPending(undefined)}
      >
        <DialogTitle className={fontClassName.className}>
          {t('rolesConfirmTitle')}
        </DialogTitle>
        <DialogContent className="flex flex-col gap-2">
          {pending && (
            <Typography className={fontClassName.className}>
              {t('rolesConfirmText', {
                name: pending.user.name.trim() || pending.user.email,
                from: roleLabel(pending.user.grade),
                to: roleLabel(pending.grade),
              })}
            </Typography>
          )}
          {saveError && <Alert severity="error">{t('rolesChangeError')}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setPending(undefined)}
            disabled={saving}
            sx={{ textTransform: 'none' }}
          >
            {t('cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={confirmChange}
            disabled={saving}
            sx={{ textTransform: 'none' }}
          >
            {t('save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
