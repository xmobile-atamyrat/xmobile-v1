import { useFetchWithCreds } from '@/pages/lib/fetch';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  createOrUpdateProductPrice,
  getAllProductPrices,
  updateProductPriceInCatalog,
} from '@/pages/procurement/lib/apis';
import { DetailedProductPrice } from '@/pages/procurement/lib/types';
import {
  convertCurrency,
  downloadExcelFile,
} from '@/pages/procurement/lib/utils';
import { debounce } from '@/pages/product/utils';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

export default function AllPrices() {
  const { user, accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const router = useRouter();

  const [productPrices, setProductPrices] = useState<DetailedProductPrice[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'TMT'>('USD');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();

  const [downloadMode, setDownloadMode] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'productName',
  ]);

  const fetchAllPrices = useCallback(async () => {
    if (!accessToken) return;

    setLoading(true);
    try {
      const { success, data, message } = await getAllProductPrices({
        accessToken,
        fetchWithCreds,
      });

      if (success) {
        setProductPrices(data || []);
      } else {
        console.error(message);
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: 'Ошибка загрузки цен',
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Fetch all prices error:', error);
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'Ошибка сервера',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [accessToken, fetchWithCreds]);

  useEffect(() => {
    if (accessToken) {
      fetchAllPrices();
    }
  }, [accessToken]);

  const handlePriceUpdate = useCallback(
    debounce(async (priceId: string, field: string, value: number | string) => {
      if (!accessToken) return;

      try {
        // Check if this is a productId (for new records) or an actual price id
        const isNewRecord = !productPrices.find((p) => p.id === priceId);

        if (isNewRecord) {
          // Create new record using productId
          const { success } = await createOrUpdateProductPrice({
            accessToken,
            productId: priceId, // priceId is actually productId in this case
            [field]: value,
            fetchWithCreds,
          });

          if (success) {
            // Refresh data to get the new record
            fetchAllPrices();
            setSnackbarOpen(true);
            setSnackbarMessage({
              message: 'Цена создана',
              severity: 'success',
            });
          }
        } else {
          // Update existing record
          const { success } = await updateProductPriceInCatalog({
            accessToken,
            id: priceId,
            [field]: value,
            fetchWithCreds,
          });

          if (success) {
            // Update local state
            setProductPrices((prev) =>
              prev.map((price) =>
                price.id === priceId ? { ...price, [field]: value } : price,
              ),
            );

            setSnackbarOpen(true);
            setSnackbarMessage({
              message: 'Цена обновлена',
              severity: 'success',
            });
          }
        }
      } catch (error) {
        console.error('Price update error:', error);
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: 'Ошибка обновления цены',
          severity: 'error',
        });
      }
    }, 500),
    [accessToken, fetchWithCreds, productPrices, fetchAllPrices],
  );

  const convertPrice = useCallback(
    (price: number | null | undefined, fromCurrency: string) => {
      if (!price) return price;
      // For simplification, assuming fixed exchange rates for now
      // In production, you'd want to get these from the database
      let exchangeRateToUsd = 1.0;
      if (fromCurrency === 'CNY') {
        exchangeRateToUsd = 7.0;
      } else if (fromCurrency === 'AED') {
        exchangeRateToUsd = 3.67;
      }
      const usdToTmtRate = 3.5;

      return convertCurrency(
        price,
        fromCurrency,
        displayCurrency,
        exchangeRateToUsd,
        usdToTmtRate,
      );
    },
    [displayCurrency],
  );

  const formatPrice = useCallback(
    (price: number | null | undefined) => {
      if (!price) return '';
      return displayCurrency === 'TMT'
        ? `${Math.round(price)}`
        : `${price.toFixed(2)}`;
    },
    [displayCurrency],
  );

  const availableColumns = [
    { key: 'productName', label: 'Название товара', required: true },
    { key: 'originalPrice', label: 'Исходная цена' },
    { key: 'singlePrice', label: 'Розничная цена' },
    { key: 'bulkPrice', label: 'Оптовая цена' },
    { key: 'originalCurrency', label: 'Исходная валюта' },
    { key: 'lastUpdated', label: 'Последнее обновление' },
  ];

  const handleDownload = async () => {
    if (selectedColumns.length === 0) {
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'Выберите хотя бы одну колонку',
        severity: 'error',
      });
      return;
    }

    try {
      // Convert prices for download
      const dataForDownload = productPrices.map((item) => ({
        ...item,
        singlePrice: convertPrice(
          item.singlePrice,
          item.originalCurrency || 'USD',
        ),
        bulkPrice: convertPrice(item.bulkPrice, item.originalCurrency || 'USD'),
        originalPrice: convertPrice(
          item.originalPrice,
          item.originalCurrency || 'USD',
        ),
      }));

      const success = await downloadExcelFile(
        dataForDownload,
        selectedColumns,
        `все-цены-${displayCurrency}-${new Date().toISOString().split('T')[0]}`,
        displayCurrency,
      );

      if (success) {
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: 'Файл успешно скачан',
          severity: 'success',
        });
        setDownloadMode(false);
      } else {
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: 'Ошибка при скачивании файла',
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Download error:', error);
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'Ошибка при скачивании файла',
        severity: 'error',
      });
    }
  };

  const handleBackToPrices = () => {
    router.push('/procurement');
  };

  if (!user || user.grade !== 'SUPERUSER') {
    return (
      <Box className="flex h-screen items-center justify-center">
        <Typography variant="h6" color="error">
          Доступ запрещен
        </Typography>
      </Box>
    );
  }

  return (
    <Box className="container mx-auto p-4">
      <Box className="mb-6 flex items-center justify-between">
        <Box className="flex items-center gap-2">
          <IconButton
            onClick={() => router.push('/procurement')}
            sx={{ mr: 1 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            Все цены
          </Typography>
        </Box>
        <Box className="flex gap-2">
          <FormControl size="small">
            <InputLabel>Валюта</InputLabel>
            <Select
              value={displayCurrency}
              label="Валюта"
              onChange={(e) =>
                setDisplayCurrency(e.target.value as 'USD' | 'TMT')
              }
            >
              <MenuItem value="USD">USD</MenuItem>
              <MenuItem value="TMT">TMT</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant={downloadMode ? 'contained' : 'outlined'}
            onClick={() => setDownloadMode(!downloadMode)}
          >
            {downloadMode ? 'Отменить' : 'Скачать'}
          </Button>
          <Button variant="outlined" onClick={handleBackToPrices}>
            К истории цен
          </Button>
        </Box>
      </Box>

      {downloadMode && (
        <Card className="mb-4">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Выберите колонки для скачивания
            </Typography>
            <Box className="grid gap-2 md:grid-cols-3">
              {availableColumns.map((column) => (
                <Box key={column.key}>
                  <Checkbox
                    checked={selectedColumns.includes(column.key)}
                    disabled={column.required}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedColumns((prev) => [...prev, column.key]);
                      } else {
                        setSelectedColumns((prev) =>
                          prev.filter((col) => col !== column.key),
                        );
                      }
                    }}
                  />
                  {column.label}
                  {column.required && ' (обязательно)'}
                </Box>
              ))}
            </Box>
            <Box className="mt-4 flex gap-2">
              <Button variant="contained" onClick={handleDownload}>
                Скачать Excel
              </Button>
              <Typography variant="body2" className="flex items-center">
                Валюта: {displayCurrency}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Box className="flex justify-center p-8">
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Название товара</TableCell>
                  <TableCell>Исходная цена</TableCell>
                  <TableCell>Исходная валюта</TableCell>
                  <TableCell>Розничная цена ({displayCurrency})</TableCell>
                  <TableCell>Оптовая цена ({displayCurrency})</TableCell>
                  <TableCell>Последнее обновление</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {productPrices.map((productPrice) => (
                  <TableRow key={productPrice.productId}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {productPrice.product.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        size="small"
                        value={productPrice.originalPrice || ''}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!Number.isNaN(value)) {
                            handlePriceUpdate(
                              productPrice.id || productPrice.productId,
                              'originalPrice',
                              value,
                            );
                          }
                        }}
                        placeholder="Исходная цена"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        size="small"
                        value={productPrice.originalCurrency || 'USD'}
                        onChange={(e) => {
                          handlePriceUpdate(
                            productPrice.id || productPrice.productId,
                            'originalCurrency',
                            e.target.value,
                          );
                        }}
                      >
                        <MenuItem value="USD">USD</MenuItem>
                        <MenuItem value="TMT">TMT</MenuItem>
                        <MenuItem value="AED">AED</MenuItem>
                        <MenuItem value="CNY">CNY</MenuItem>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        size="small"
                        value={formatPrice(
                          convertPrice(
                            productPrice.singlePrice,
                            productPrice.originalCurrency || 'USD',
                          ),
                        )}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!Number.isNaN(value)) {
                            // Convert back to original currency for storage
                            const originalValue = convertPrice(
                              value,
                              displayCurrency,
                            );
                            handlePriceUpdate(
                              productPrice.id || productPrice.productId,
                              'singlePrice',
                              originalValue,
                            );
                          }
                        }}
                        placeholder="Розничная цена"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        size="small"
                        value={formatPrice(
                          convertPrice(
                            productPrice.bulkPrice,
                            productPrice.originalCurrency || 'USD',
                          ),
                        )}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!Number.isNaN(value)) {
                            // Convert back to original currency for storage
                            const originalValue = convertPrice(
                              value,
                              displayCurrency,
                            );
                            handlePriceUpdate(
                              productPrice.id || productPrice.productId,
                              'bulkPrice',
                              originalValue,
                            );
                          }
                        }}
                        placeholder="Оптовая цена"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="textSecondary">
                        {productPrice.updatedAt
                          ? new Date(productPrice.updatedAt).toLocaleDateString(
                              'ru-RU',
                            )
                          : 'Никогда'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarMessage?.severity}
        >
          {snackbarMessage?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
