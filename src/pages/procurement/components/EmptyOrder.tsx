import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  handleProductSearchUtil,
  handleSupplierSearchUtil,
} from '@/pages/procurement/lib/utils';
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
  TextField,
} from '@mui/material';
import { ProcurementProduct, Supplier } from '@prisma/client';
import { JsonValue } from '@prisma/client/runtime/library';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction, useCallback, useState } from 'react';

interface EmptyOrderProps {
  productQuantities: JsonValue;
  selectedSuppliers: Supplier[];
  setSelectedSuppliers: Dispatch<SetStateAction<Supplier[]>>;
  selectedProducts: ProcurementProduct[];
  setSelectedProducts: Dispatch<SetStateAction<ProcurementProduct[]>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
}

export default function EmptyOrder({
  selectedProducts,
  selectedSuppliers,
  productQuantities,
  setSnackbarMessage,
  setSnackbarOpen,
}: EmptyOrderProps) {
  const { accessToken } = useUserContext();
  const t = useTranslations();
  const [productQuantity, setProductQuantity] = useState<number[]>(
    productQuantities
      ? (productQuantities as number[]).map((quantity) => quantity)
      : Array(selectedProducts.length),
  );
  const [searchedProducts, setSearchedProducts] = useState<
    ProcurementProduct[]
  >([]);
  const [searchProductKeyword, setSearchProductKeyword] = useState('');
  const [searchedSuppliers, setSearchedSuppliers] = useState<Supplier[]>([]);
  const [searchSupplierKeyword, setSearchSupplierKeyword] = useState('');
  const [searchedProductsAnchor, setSearchedProductsAnchor] =
    useState<HTMLElement | null>(null);

  const handleProductSearch = useCallback(
    debounce(async (keyword: string) => {
      await handleProductSearchUtil(
        accessToken,
        keyword,
        setSearchedProducts,
        setSnackbarOpen,
        setSnackbarMessage,
      );
    }, 300),
    [debounce, accessToken],
  );

  const handleSupplierSearch = useCallback(
    debounce(async (keyword: string) => {
      await handleSupplierSearchUtil(
        accessToken,
        keyword,
        setSearchedSuppliers,
        setSnackbarOpen,
        setSnackbarMessage,
      );
    }, 300),
    [debounce, accessToken],
  );

  return (
    <Box className="flex flex-col gap-2">
      <Box className="flex flex-row justify-between items-center">
        {/* {SearchBar({
              handleSearch: handleProductSearch,
              searchKeyword: searchProductKeyword,
              setSearchKeyword: setSearchProductKeyword,
              searchPlaceholder: t('search'),
              width: '100%',
            })} */}
        <Button sx={{ textTransform: 'none' }} variant="outlined">
          {t('addProducts')}
        </Button>
        {/* {SearchBar({
              handleSearch: handleSupplierSearch,
              searchKeyword: searchSupplierKeyword,
              setSearchKeyword: setSearchSupplierKeyword,
              searchPlaceholder: t('search'),
              width: '100%',
            })} */}
        <Button sx={{ textTransform: 'none' }} variant="outlined">
          {t('addSuppliers')}
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell></TableCell>
              <TableCell align="center">{t('quantity')}</TableCell>
              {selectedSuppliers.map((supplier) => (
                <TableCell key={supplier.id} align="center">
                  {supplier.name}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {selectedProducts.map((product, prdIdx) => (
              <TableRow key={product.id}>
                <TableCell align="left">{product.name}</TableCell>
                <TableCell align="center">
                  <TextField
                    size="small"
                    value={productQuantity[prdIdx] ?? ''}
                    type="number"
                    onChange={(e) => {
                      const newProductQuantity = [...productQuantity];
                      newProductQuantity[prdIdx] =
                        e.target.value === ''
                          ? undefined
                          : Number(e.target.value);
                      setProductQuantity(newProductQuantity);
                    }}
                  />
                </TableCell>
                {selectedSuppliers.map((supplier) => (
                  <TableCell key={supplier.id} align="center">
                    <TextField size="small" type="number" disabled />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* <Menu
        anchorEl={searchedProductsAnchor}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        open={Boolean(searchedProductsAnchor)}
        onClose={() => {
          setSearchedProductsAnchor(null);
        }}
      >
        {searchedProducts.map((product) => (
          <MenuItem
            key={product.id}
            onClick={() => {
              // TODO: implement
            }}
          >
            {product.name}
          </MenuItem>
        ))}
      </Menu> */}
    </Box>
  );
}
