import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { interClassname } from '@/styles/theme';
import { Alert, Box, CircularProgress, Paper, Typography } from '@mui/material';
import { GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';

export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

interface MonitoringData {
  timestamp: string;
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
}

interface SSEMessage {
  type: 'connected' | 'metrics' | 'error';
  data?: MonitoringData;
  message?: string;
}

export default function MonitoringPage() {
  const router = useRouter();
  const { user, accessToken, isLoading } = useUserContext();
  const platform = usePlatform();

  const [metrics, setMetrics] = useState<MonitoringData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

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

  // Set up SSE connection
  useEffect(() => {
    if (!accessToken || !user || !['ADMIN', 'SUPERUSER'].includes(user.grade)) {
      return;
    }

    const connectSSE = () => {
      try {
        const eventSource = new EventSource(
          `/api/monitoring/stream?accessToken=${accessToken}`,
        );

        eventSource.onopen = () => {
          setConnected(true);
          setError(null);
        };

        eventSource.onmessage = (event) => {
          try {
            const message: SSEMessage = JSON.parse(event.data);

            if (message.type === 'connected') {
              setConnected(true);
            } else if (message.type === 'metrics' && message.data) {
              setMetrics(message.data);
              setError(null);
            } else if (message.type === 'error') {
              setError(message.message || 'Error receiving metrics');
            }
          } catch (err) {
            console.error('Error parsing SSE message:', err);
          }
        };

        eventSource.onerror = (err) => {
          console.error('SSE error:', err);
          setConnected(false);
          setError('Connection lost. Attempting to reconnect...');
          eventSource.close();

          // Attempt to reconnect after 3 seconds
          setTimeout(() => {
            if (accessToken && user) {
              connectSSE();
            }
          }, 3000);
        };

        eventSourceRef.current = eventSource;
      } catch (err) {
        console.error('Error setting up SSE:', err);
        setError('Failed to connect to monitoring stream');
      }
    };

    connectSSE();

    // Cleanup on unmount
    // eslint-disable-next-line consistent-return
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [accessToken, user, router]);

  if (isLoading) {
    return null;
  }

  if (!user || !['ADMIN', 'SUPERUSER'].includes(user.grade)) {
    return null;
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

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
        <Box className="flex flex-row items-center justify-between">
          <Typography
            className={interClassname.className}
            fontWeight={600}
            fontSize={platform === 'web' ? 24 : 20}
          >
            System Monitoring
          </Typography>
          <Box className="flex flex-row items-center gap-2">
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: connected ? '#4caf50' : '#f44336',
              }}
            />
            <Typography
              className={interClassname.className}
              variant="body2"
              color={connected ? '#4caf50' : '#f44336'}
            >
              {connected ? 'Connected' : 'Disconnected'}
            </Typography>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" className="w-full">
            {error}
          </Alert>
        )}

        {!connected && !error && (
          <Box className="flex items-center justify-center py-12">
            <CircularProgress />
          </Box>
        )}

        {connected && metrics && (
          <Box className="flex flex-col gap-4">
            {/* CPU Metrics */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                backgroundColor: '#f5f5f5',
              }}
            >
              <Typography
                className={interClassname.className}
                fontWeight={600}
                variant="h6"
                gutterBottom
              >
                CPU Usage
              </Typography>
              <Box className="flex flex-col gap-2">
                <Box className="flex flex-row justify-between items-center">
                  <Typography className={interClassname.className}>
                    Usage:
                  </Typography>
                  <Typography
                    className={interClassname.className}
                    fontWeight={600}
                  >
                    {metrics.cpu.usage.toFixed(2)}%
                  </Typography>
                </Box>
                <Box className="w-full bg-gray-200 rounded-full h-4">
                  <Box
                    sx={{
                      width: `${Math.min(metrics.cpu.usage, 100)}%`,
                      height: '100%',
                      backgroundColor: (() => {
                        if (metrics.cpu.usage > 80) return '#f44336';
                        if (metrics.cpu.usage > 60) return '#ff9800';
                        return '#4caf50';
                      })(),
                      borderRadius: 'inherit',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </Box>
                <Box className="flex flex-row justify-between items-center">
                  <Typography
                    className={interClassname.className}
                    variant="body2"
                  >
                    Cores: {metrics.cpu.cores}
                  </Typography>
                  <Typography
                    className={interClassname.className}
                    variant="body2"
                  >
                    Load:{' '}
                    {metrics.cpu.loadAverage
                      .map((l) => l.toFixed(2))
                      .join(', ')}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* Memory Metrics */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                backgroundColor: '#f5f5f5',
              }}
            >
              <Typography
                className={interClassname.className}
                fontWeight={600}
                variant="h6"
                gutterBottom
              >
                Memory Usage
              </Typography>
              <Box className="flex flex-col gap-2">
                <Box className="flex flex-row justify-between items-center">
                  <Typography className={interClassname.className}>
                    Usage:
                  </Typography>
                  <Typography
                    className={interClassname.className}
                    fontWeight={600}
                  >
                    {metrics.memory.usage.toFixed(2)}%
                  </Typography>
                </Box>
                <Box className="w-full bg-gray-200 rounded-full h-4">
                  <Box
                    sx={{
                      width: `${Math.min(metrics.memory.usage, 100)}%`,
                      height: '100%',
                      backgroundColor: (() => {
                        if (metrics.memory.usage > 80) return '#f44336';
                        if (metrics.memory.usage > 60) return '#ff9800';
                        return '#4caf50';
                      })(),
                      borderRadius: 'inherit',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </Box>
                <Box className="flex flex-col gap-1">
                  <Box className="flex flex-row justify-between items-center">
                    <Typography
                      className={interClassname.className}
                      variant="body2"
                    >
                      Used:
                    </Typography>
                    <Typography
                      className={interClassname.className}
                      variant="body2"
                    >
                      {formatBytes(metrics.memory.used)}
                    </Typography>
                  </Box>
                  <Box className="flex flex-row justify-between items-center">
                    <Typography
                      className={interClassname.className}
                      variant="body2"
                    >
                      Free:
                    </Typography>
                    <Typography
                      className={interClassname.className}
                      variant="body2"
                    >
                      {formatBytes(metrics.memory.free)}
                    </Typography>
                  </Box>
                  <Box className="flex flex-row justify-between items-center">
                    <Typography
                      className={interClassname.className}
                      variant="body2"
                    >
                      Total:
                    </Typography>
                    <Typography
                      className={interClassname.className}
                      variant="body2"
                    >
                      {formatBytes(metrics.memory.total)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Paper>

            {/* Timestamp */}
            <Typography
              className={interClassname.className}
              variant="body2"
              color="text.secondary"
              align="center"
            >
              Last updated: {formatTimestamp(metrics.timestamp)}
            </Typography>
          </Box>
        )}
      </Box>
    </Layout>
  );
}
