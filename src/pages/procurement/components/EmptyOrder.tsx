import { SnackbarProps } from '@/pages/lib/types';
import {
  Box,
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
import { Dispatch, SetStateAction, useState } from 'react';

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
}: EmptyOrderProps) {
  const t = useTranslations();
  const [productQuantity, setProductQuantity] = useState<number[]>(
    productQuantities
      ? (productQuantities as number[]).map((quantity) => quantity)
      : Array(selectedProducts.length),
  );

  return (
    <Box className="flex flex-col gap-2">
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
