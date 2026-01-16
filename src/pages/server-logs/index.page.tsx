import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { interClassname } from '@/styles/theme';
import {
  Alert,
  Box,
  CircularProgress,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Typography,
} from '@mui/material';
import { GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export const getStaticProps = (async () => {
  // For static export, we can't rely on context.locale (Next.js i18n)
  // Load default locale messages at build time
  // Client-side will switch locale based on cookie
  const defaultLocale = 'ru';
  let messages = {};
  try {
    messages = (await import(`../../i18n/${defaultLocale}.json`)).default;
  } catch (error) {
    console.error('Error loading messages:', error);
  }

  return {
    props: {
      messages,
      // Also load all locale messages so client can switch without page reload
      allMessages: {
        en: (await import('../../i18n/en.json')).default,
        ru: (await import('../../i18n/ru.json')).default,
        tk: (await import('../../i18n/tk.json')).default,
        ch: (await import('../../i18n/ch.json')).default,
        tr: (await import('../../i18n/tr.json')).default,
      },
    },
  };
}) satisfies GetStaticProps<object>;

interface LogFile {
  filename: string;
  content: string;
}

export default function LogsPage() {
  const router = useRouter();
  const { user, accessToken, isLoading } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const platform = usePlatform();

  const [logFiles, setLogFiles] = useState<string[]>([]);
  const [selectedLogFile, setSelectedLogFile] = useState<string>('');
  const [logContent, setLogContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');

  // Redirect to sign in if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/user/sign_in_up');
    }
  }, [user, isLoading, router]);

  // Check admin permissions
  useEffect(() => {
    if (!user) return;

    if (!['ADMIN', 'SUPERUSER'].includes(user.grade)) {
      router.push('/');
    }
  }, [user, router]);

  // Fetch list of log files
  useEffect(() => {
    if (!accessToken || !user || !['ADMIN', 'SUPERUSER'].includes(user.grade)) {
      return;
    }

    const fetchLogFiles = async () => {
      setLoadingFiles(true);
      setError(null);
      try {
        const response = await fetchWithCreds<string[]>({
          accessToken: accessToken!,
          path: '/api/server-logs',
          method: 'GET',
        });

        if (response.success && response.data) {
          setLogFiles(response.data);
          if (response.data.length > 0 && !selectedLogFile) {
            setSelectedLogFile(response.data[0]);
          }
        } else {
          setError(response.message || 'Failed to fetch log files');
          setSnackbarMessage(response.message || 'Failed to fetch log files');
          setSnackbarOpen(true);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch log files';
        setError(errorMessage);
        setSnackbarMessage(errorMessage);
        setSnackbarOpen(true);
      } finally {
        setLoadingFiles(false);
      }
    };

    fetchLogFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, user]);

  // Fetch log content when a file is selected
  useEffect(() => {
    if (!selectedLogFile || !accessToken) return;

    const fetchLogContent = async () => {
      setLoading(true);
      setError(null);
      setLogContent('');
      try {
        const response = await fetchWithCreds<LogFile>({
          accessToken: accessToken!,
          path: `/api/server-logs/${selectedLogFile}`,
          method: 'GET',
        });

        if (response.success && response.data) {
          setLogContent(response.data.content);
        } else {
          const errorMessage =
            response.message || 'Failed to fetch log content';
          setError(errorMessage);
          setSnackbarMessage(errorMessage);
          setSnackbarOpen(true);
          setLogContent('');
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch log content';
        setError(errorMessage);
        setSnackbarMessage(errorMessage);
        setSnackbarOpen(true);
        setLogContent('');
      } finally {
        setLoading(false);
      }
    };

    fetchLogContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLogFile, accessToken]);

  if (isLoading) {
    return null;
  }

  if (!user || !['ADMIN', 'SUPERUSER'].includes(user.grade)) {
    return null;
  }

  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      <Box
        sx={{
          mt:
            platform === 'web'
              ? `${appBarHeight}px`
              : `${mobileAppBarHeight}px`,
          p: platform === 'web' ? 2 : 1,
        }}
        className="flex flex-col gap-4 w-full h-full"
      >
        <Typography
          className={interClassname.className}
          fontWeight={600}
          fontSize={platform === 'web' ? 24 : 20}
        >
          Log Viewer
        </Typography>

        {/* Log File Selector */}
        <Box className="flex flex-col gap-2">
          <Typography
            className={interClassname.className}
            variant="body2"
            fontWeight={500}
          >
            Select Log File
          </Typography>
          {loadingFiles ? (
            <Box className="flex items-center justify-center py-4">
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Select
              value={selectedLogFile}
              onChange={(e) => setSelectedLogFile(e.target.value)}
              displayEmpty
              fullWidth
              sx={{
                backgroundColor: 'white',
                borderRadius: '10px',
              }}
            >
              {logFiles.length === 0 ? (
                <MenuItem value="" disabled>
                  No log files found
                </MenuItem>
              ) : (
                logFiles.map((file) => (
                  <MenuItem key={file} value={file}>
                    {file}
                  </MenuItem>
                ))
              )}
            </Select>
          )}
        </Box>

        {/* Log Content Display */}
        {selectedLogFile && (
          <Box className="flex flex-col gap-2 flex-1 min-h-0">
            <Typography
              className={interClassname.className}
              variant="body2"
              fontWeight={500}
            >
              {selectedLogFile}
            </Typography>
            {loading && (
              <Box className="flex items-center justify-center py-12">
                <CircularProgress />
              </Box>
            )}
            {!loading && error && (
              <Alert severity="error" className="w-full">
                {error}
              </Alert>
            )}
            {!loading && !error && (
              <Paper
                elevation={0}
                sx={{
                  flex: 1,
                  minHeight: 0,
                  backgroundColor: '#1e1e1e',
                  color: '#d4d4d4',
                  p: 2,
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: platform === 'web' ? '14px' : '12px',
                  lineHeight: 1.5,
                }}
              >
                <Box
                  component="pre"
                  sx={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {logContent || 'No content available'}
                </Box>
              </Paper>
            )}
          </Box>
        )}

        {/* Snackbar for errors */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={(_, reason) => {
            if (reason === 'clickaway') {
              return;
            }
            setSnackbarOpen(false);
          }}
        >
          <Alert
            onClose={() => setSnackbarOpen(false)}
            severity="error"
            variant="filled"
            sx={{ width: '100%' }}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </Box>
    </Layout>
  );
}
