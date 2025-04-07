import { SearchBar } from '@/pages/components/Appbar';
import { fetchWithCreds } from '@/pages/lib/fetch';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  Box,
  Button,
  debounce,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ProcurementProduct } from '@prisma/client';
import { useTranslations } from 'next-intl';
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react';

interface ProductTablesProps {
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
}

export default function ProductTables({
  setSnackbarMessage,
  setSnackbarOpen,
}: ProductTablesProps) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const { accessToken } = useUserContext();
  const [products, setProducts] = useState<ProcurementProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<
    ProcurementProduct[]
  >([]);
  const t = useTranslations();

  const handleSearch = useCallback(
    debounce(async (keyword: string) => {
      try {
        const { success, data, message } = await fetchWithCreds<
          ProcurementProduct[]
        >(
          accessToken,
          `/api/procurement/product?searchKeyword=${keyword}`,
          'GET',
        );
        if (success) {
          setProducts(data);
        } else {
          console.error(message);
          setSnackbarOpen(true);
          setSnackbarMessage({
            message: 'serverError',
            severity: 'error',
          });
        }
      } catch (error) {
        console.error(error);
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: 'fetchPricesError',
          severity: 'error',
        });
      }
    }, 300),
    [debounce, accessToken],
  );

  const createProduct = useCallback(async () => {
    if (searchKeyword == null || searchKeyword === '') {
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'nameRequired',
        severity: 'error',
      });
      return;
    }

    try {
      const { success, data, message } =
        await fetchWithCreds<ProcurementProduct>(
          accessToken,
          '/api/procurement/product',
          'POST',
          {
            name: searchKeyword,
          },
        );
      if (success) {
        setProducts([data]);
      } else {
        console.error(message);
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: 'serverError',
          severity: 'error',
        });
      }
    } catch (error) {
      console.error(error);
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'serverError',
        severity: 'error',
      });
    }
  }, [accessToken, searchKeyword, products]);

  useEffect(() => {
    if (accessToken) {
      (async () => {
        try {
          const { success, data, message } = await fetchWithCreds<
            ProcurementProduct[]
          >(accessToken, `/api/procurement/product`, 'GET');
          if (success) {
            setProducts(data);
          } else {
            setSnackbarOpen(true);
            setSnackbarMessage({
              message,
              severity: 'error',
            });
          }
        } catch (error) {
          console.error(error);
          setSnackbarOpen(true);
          setSnackbarMessage({
            message: 'fetchPricesError',
            severity: 'error',
          });
        }
      })();
    }
  }, [accessToken]);

  return (
    <Box className="flex flex-row h-full w-full min-h-[400px] gap-8 items-center">
      {/* Product list */}
      <Box className="flex flex-col h-[600px] w-1/2 items-start">
        <TableContainer component={Paper}>
          <Table className="w-full h-full" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell align="justify" colSpan={3}>
                  <Box className="flex flex-row gap-4">
                    {SearchBar({
                      handleSearch,
                      searchKeyword,
                      searchPlaceholder: t('search'),
                      setSearchKeyword,
                      width: '100%',
                    })}
                    <Button onClick={createProduct}>{t('add')}</Button>
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell
                    onClick={() => {
                      setSelectedProducts([product, ...selectedProducts]);
                    }}
                  >
                    {product.name}
                  </TableCell>
                  {/* <IconButton className="flex items-center h-full">
                    <DeleteIcon color="error" />
                  </IconButton> */}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
      <Typography fontWeight={600} fontSize={24}>
        {'>'}
      </Typography>
      {/* Selected products */}
      <Box className="flex flex-col h-[600px] w-1/2 items-start">
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell colSpan={3}>
                  <Box className="flex flex-row gap-4 items-center w-full justify-between">
                    <Typography fontWeight={600} fontSize={16}>
                      {t('selectedProducts')}
                    </Typography>
                    <Button>{t('calculate')}</Button>
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {selectedProducts.map(({ name, id }) => (
                <TableRow key={id}>
                  <TableCell
                    onClick={() => {
                      setSelectedProducts(
                        selectedProducts.filter((product) => product.id !== id),
                      );
                    }}
                  >
                    {name}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
}
