import DeleteDialog from '@/pages/components/DeleteDialog';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { hideTextfieldSpinButtons } from '@/pages/lib/utils';
import {
  deletePricesUtil,
  deleteQuantityUtil,
  editHistoryUtil,
  editProductPricesUtil,
  editProductQuantityUtil,
} from '@/pages/procurement/lib/apiUtils';
import {
  HISTORY_COLORS,
  HistoryPrice,
  ProductsSuppliersType,
} from '@/pages/procurement/lib/types';
import { priceHash } from '@/pages/procurement/lib/utils';
import { debounce } from '@/pages/product/utils';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {
  Box,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  ProcurementOrder,
  ProcurementOrderProductQuantity,
  ProcurementProduct,
  ProcurementSupplier,
} from '@prisma/client';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction, useCallback, useState } from 'react';

interface EmptyOrderProps {
  setProductQuantities: Dispatch<
    SetStateAction<ProcurementOrderProductQuantity[]>
  >;
  selectedSuppliers: ProcurementSupplier[];
  setSelectedSuppliers: Dispatch<SetStateAction<ProcurementSupplier[]>>;
  selectedProducts: ProcurementProduct[];
  setSelectedProducts: Dispatch<SetStateAction<ProcurementProduct[]>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  selectedHistory: ProcurementOrder;
  prices: HistoryPrice;
  setPrices: Dispatch<SetStateAction<HistoryPrice>>;
  hashedQuantities: Record<string, number>;
  setHashedQuantities: Dispatch<SetStateAction<Record<string, number>>>;
}

export default function EmptyOrder({
  selectedProducts,
  selectedSuppliers,
  setProductQuantities,
  setSelectedProducts,
  setSelectedSuppliers,
  setSnackbarMessage,
  setSnackbarOpen,
  selectedHistory,
  prices,
  setPrices,
  hashedQuantities,
  setHashedQuantities,
}: EmptyOrderProps) {
  const { accessToken } = useUserContext();
  const t = useTranslations();
  const [confirmRemoveItemDialog, setConfirmRemoveItemDialog] = useState<{
    itemType: ProductsSuppliersType;
    item: ProcurementSupplier | ProcurementProduct;
  }>();
  const [colorPrice, setColorPrice] = useState<{
    anchor: HTMLElement | null;
    priceHash: string;
  }>();
  const fetchWithCreds = useFetchWithCreds();

  const handleDelete = async () => {
    if (confirmRemoveItemDialog?.itemType === 'supplier') {
      const updatedHistory = await editHistoryUtil({
        id: selectedHistory.id,
        accessToken,
        removedSupplierIds: [confirmRemoveItemDialog.item.id],
        setSnackbarMessage,
        setSnackbarOpen,
        fetchWithCreds,
      });
      const updatedPrices = await deletePricesUtil({
        accessToken,
        ids: selectedProducts
          .map(({ id }) => {
            return {
              orderId: selectedHistory.id,
              productId: id,
              supplierId: confirmRemoveItemDialog.item.id,
            };
          })
          .filter((toHash) => prices[priceHash(toHash)] != null),
        setSnackbarMessage,
        setSnackbarOpen,
        fetchWithCreds,
      });
      if (updatedHistory && updatedPrices) {
        setSelectedSuppliers((prev) =>
          prev.filter(
            (supplier) => supplier.id !== confirmRemoveItemDialog.item.id,
          ),
        );
        setPrices((currPrices) => {
          const newPrices = currPrices;
          selectedProducts.forEach(({ id }) => {
            delete newPrices[
              priceHash({
                orderId: selectedHistory.id,
                productId: id,
                supplierId: confirmRemoveItemDialog.item.id,
              })
            ];
          });
          return newPrices;
        });
      }
    } else {
      const updatedHistory = await editHistoryUtil({
        id: selectedHistory.id,
        accessToken,
        removedProductIds: [confirmRemoveItemDialog.item.id],
        setSnackbarMessage,
        setSnackbarOpen,
        fetchWithCreds,
      });
      const deletedQuantity = await deleteQuantityUtil({
        accessToken,
        orderId: selectedHistory.id,
        productId: confirmRemoveItemDialog.item.id,
        setSnackbarMessage,
        setSnackbarOpen,
        fetchWithCreds,
      });
      const deletedPrice = await deletePricesUtil({
        accessToken,
        ids: selectedSuppliers
          .map(({ id }) => {
            return {
              orderId: selectedHistory.id,
              productId: confirmRemoveItemDialog.item.id,
              supplierId: id,
            };
          })
          .filter((toHash) => prices[JSON.stringify(toHash)] != null),
        setSnackbarMessage,
        setSnackbarOpen,
        fetchWithCreds,
      });
      if (updatedHistory && deletedQuantity && deletedPrice) {
        setSelectedProducts((prev) =>
          prev.filter(
            (product) => product.id !== confirmRemoveItemDialog.item.id,
          ),
        );
        setProductQuantities((prev) =>
          prev.filter((pq) => pq.productId !== confirmRemoveItemDialog.item.id),
        );
        setPrices((currPrices) => {
          const newPrices = currPrices;
          selectedSuppliers.forEach(({ id }) => {
            delete newPrices[
              JSON.stringify({
                orderId: selectedHistory.id,
                productId: confirmRemoveItemDialog.item.id,
                supplierId: id,
              })
            ];
          });
          return newPrices;
        });
      }
    }
    setConfirmRemoveItemDialog(undefined);
  };

  const handleQuantityUpdate = useCallback(
    debounce(async (updatedQuantity: number, productId: string) => {
      await editProductQuantityUtil({
        accessToken,
        orderId: selectedHistory.id,
        productId,
        quantity: updatedQuantity,
        setSnackbarMessage,
        setSnackbarOpen,
        fetchWithCreds,
      });
    }, 300),
    [debounce, accessToken, selectedHistory],
  );

  const handlePriceUpdate = useCallback(
    debounce(
      async (updatedPrice: number, productId: string, supplierId: string) => {
        await editProductPricesUtil({
          accessToken,
          updatedPrices: [
            {
              orderId: selectedHistory.id,
              productId,
              supplierId,
              price: updatedPrice,
            },
          ],
          setSnackbarMessage,
          setSnackbarOpen,
          fetchWithCreds,
        });
      },
      300,
    ),
    [debounce, accessToken, selectedHistory],
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
                  <Box className="flex w-full items-center gap-2 justify-center">
                    <Typography>{supplier.name}</Typography>
                    <IconButton
                      onClick={() =>
                        setConfirmRemoveItemDialog({
                          itemType: 'supplier',
                          item: supplier,
                        })
                      }
                    >
                      <DeleteIcon color="error" />
                    </IconButton>
                  </Box>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {selectedProducts.map((product) => {
              return (
                <TableRow key={product.id}>
                  <TableCell align="left">
                    <Box className="flex w-full items-center justify-between">
                      <Typography>{product.name}</Typography>
                      <IconButton
                        onClick={() =>
                          setConfirmRemoveItemDialog({
                            itemType: 'product',
                            item: product,
                          })
                        }
                      >
                        <DeleteIcon color="error" />
                      </IconButton>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    {/* Quantities */}
                    <TextField
                      size="small"
                      value={hashedQuantities[product.id] ?? ''}
                      type="number"
                      InputProps={hideTextfieldSpinButtons}
                      onChange={(e) => {
                        const rawValue = e.target.value;
                        const newQuantity =
                          rawValue === '' ? null : parseInt(rawValue, 10);
                        setHashedQuantities((curr) => {
                          const newHashedQuantities = { ...curr };
                          newHashedQuantities[product.id] = newQuantity;
                          return newHashedQuantities;
                        });
                        handleQuantityUpdate(newQuantity, product.id);
                      }}
                    />
                  </TableCell>
                  {selectedSuppliers.map((supplier) => {
                    const hash = priceHash({
                      orderId: selectedHistory.id,
                      productId: product.id,
                      supplierId: supplier.id,
                    });
                    const priceColorPair = prices?.[hash];
                    return (
                      <TableCell key={supplier.id} align="center">
                        {/* Prices */}
                        <TextField
                          size="small"
                          value={priceColorPair?.value ?? ''}
                          type="number"
                          sx={{
                            backgroundColor: priceColorPair?.color || 'inherit',
                          }}
                          InputProps={{
                            ...hideTextfieldSpinButtons,
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    setColorPrice({
                                      anchor: e.currentTarget,
                                      priceHash: hash,
                                    });
                                  }}
                                >
                                  <KeyboardArrowDownIcon />
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                          onChange={async (e) => {
                            const rawValue = e.target.value;
                            const newPrice =
                              rawValue === '' ? null : parseInt(rawValue, 10);
                            setPrices((currPrices) => {
                              const newPrices = { ...currPrices };
                              newPrices[
                                JSON.stringify({
                                  orderId: selectedHistory.id,
                                  productId: product.id,
                                  supplierId: supplier.id,
                                })
                              ] = {
                                value: newPrice,
                                color: undefined,
                              };
                              return newPrices;
                            });
                            handlePriceUpdate(
                              newPrice,
                              product.id,
                              supplier.id,
                            );
                          }}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {confirmRemoveItemDialog && (
        <DeleteDialog
          blueButtonText={t('cancel')}
          redButtonText={t('delete')}
          title={t('delete')}
          description={t('confirmDelete')}
          handleClose={() => {
            setConfirmRemoveItemDialog(undefined);
          }}
          handleDelete={handleDelete}
        />
      )}

      <Menu
        open={Boolean(colorPrice?.anchor)}
        anchorEl={colorPrice?.anchor}
        onClose={() => {
          setColorPrice(undefined);
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {HISTORY_COLORS.map((color) => (
          <MenuItem
            key={color}
            className="bg-gray-300"
            onClick={() => {
              setPrices((curr) => {
                const newPrices = { ...curr };
                newPrices[colorPrice.priceHash] = {
                  ...newPrices[colorPrice.priceHash],
                  color,
                };
                return newPrices;
              });
              setColorPrice(undefined);
            }}
          >
            <Box
              sx={{
                padding: 2,
                backgroundColor: color,
              }}
            ></Box>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
