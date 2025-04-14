import { SearchBar } from '@/pages/components/Appbar';
import DeleteDialog from '@/pages/components/DeleteDialog';
import { SnackbarProps } from '@/pages/lib/types';
import {
  Box,
  Button,
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
import { Dispatch, SetStateAction, useState } from 'react';

interface DualTablesProps {
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  products: ProcurementProduct[];
  selectedProducts: ProcurementProduct[];
  setSelectedProducts: Dispatch<SetStateAction<ProcurementProduct[]>>;
  handleSearch: (...args: any[]) => void;
  createProduct: (keyword: string) => Promise<void>;
}

export default function DualTables({
  setSnackbarMessage,
  setSnackbarOpen,
  products,
  selectedProducts,
  setSelectedProducts,
  handleSearch,
  createProduct,
}: DualTablesProps) {
  const [searchKeyword, setSearchKeyword] = useState('');

  const t = useTranslations();
  const [removeSelected, setRemoveSelected] = useState<string>();

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
                    <Button
                      onClick={async () => {
                        await createProduct(searchKeyword);
                      }}
                    >
                      {t('add')}
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell
                    onClick={() => {
                      if (selectedProducts.some((p) => p.id === product.id)) {
                        setSnackbarMessage({
                          message: 'productAlreadySelected',
                          severity: 'error',
                        });
                        setSnackbarOpen(true);
                        return;
                      }
                      setSelectedProducts([product, ...selectedProducts]);
                    }}
                  >
                    {product.name}
                  </TableCell>
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
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {selectedProducts.map(({ name, id }) => (
                <TableRow key={id}>
                  <TableCell
                    onClick={() => {
                      setRemoveSelected(id);
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

      {removeSelected && (
        <DeleteDialog
          title={t('remove')}
          description={t('confirmRemoveProduct')}
          handleClose={() => setRemoveSelected(undefined)}
          handleDelete={async () => {
            setSelectedProducts(
              selectedProducts.filter(
                (product) => product.id !== removeSelected,
              ),
            );
          }}
        />
      )}
    </Box>
  );
}
