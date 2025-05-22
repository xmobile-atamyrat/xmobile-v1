import { SearchBar } from '@/pages/components/Appbar';
import DeleteDialog from '@/pages/components/DeleteDialog';
import { theme } from '@/pages/lib/utils';
import EditDialog from '@/pages/procurement/components/EditProductsSuppliersDialog';
import { ProductsSuppliersType } from '@/pages/procurement/lib/types';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { ProcurementProduct, ProcurementSupplier } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface AddProductsSuppliersDialogProps {
  handleClose: () => void;
  itemType: ProductsSuppliersType;
  handleItemSearch: (...args: any[]) => void;
  searchedItems: (ProcurementProduct | ProcurementSupplier)[];
  selectedItems: ProcurementProduct[] | ProcurementSupplier[];
  handleAddItem: (keyword: string) => Promise<void>;
  handleAddSearchedItem: (
    item: ProcurementProduct | ProcurementSupplier,
  ) => Promise<void>;
  handleEditItem: ({
    id,
    name,
    description,
  }: {
    id: string;
    name: string;
    description?: string;
  }) => Promise<void>;
  handleDeleteItem: (id: string) => Promise<void>;
}

export default function AddProductsSuppliersDialog({
  handleClose,
  itemType,
  handleItemSearch,
  searchedItems,
  selectedItems,
  handleAddItem,
  handleAddSearchedItem,
  handleDeleteItem,
  handleEditItem,
}: AddProductsSuppliersDialogProps) {
  const t = useTranslations();
  const [searchItemKeyword, setSearchItemKeyword] = useState('');
  const [editDialog, setEditDialog] = useState<
    ProcurementProduct | ProcurementSupplier
  >();
  const [deleteDialog, setDeleteDialog] = useState<
    ProcurementProduct | ProcurementSupplier
  >();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));

  return (
    <Dialog open onClose={handleClose} fullScreen>
      <DialogTitle>
        {itemType === 'product' ? t('addProducts') : t('addSuppliers')}
      </DialogTitle>
      <DialogContent>
        <Box className="flex flex-col gap-4">
          <Box className={`flex flex-${isMdUp ? 'row' : 'col'} gap-2`}>
            {SearchBar({
              handleSearch: handleItemSearch,
              searchKeyword: searchItemKeyword,
              setSearchKeyword: setSearchItemKeyword,
              searchPlaceholder: t('search'),
              width: '100%',
            })}
            <Button
              sx={{ textTransform: 'none', minWidth: 150 }}
              variant="outlined"
              onClick={async () => {
                await handleAddItem(searchItemKeyword);
              }}
            >
              {t('addToBase')}
            </Button>
          </Box>

          <Box className="flex flex-col gap-4 pl-2">
            {searchedItems.map((item) => (
              <Box
                key={item.id}
                className={`flex flex-row items-center justify-${isMdUp ? 'start' : 'between'} gap-${isMdUp ? 8 : 0}`}
              >
                <Typography className="h-[40px] flex items-center">
                  {item.name}
                </Typography>
                <Box className={`flex flex-row gap-${isMdUp ? 4 : 0}`}>
                  {selectedItems.some((i) => i.id === item.id) ? (
                    <Typography
                      color="green"
                      fontSize={12}
                      className="h-[40px] flex items-center"
                    >
                      {isMdUp ? t('alreadyExists') : t('alreadyExistsConcat')}
                    </Typography>
                  ) : (
                    <IconButton
                      onClick={async () => {
                        await handleAddSearchedItem(item);
                      }}
                    >
                      <AddCircleIcon color="primary" />
                    </IconButton>
                  )}
                  <IconButton
                    onClick={() => {
                      setEditDialog(item);
                    }}
                  >
                    <EditIcon color="primary" />
                  </IconButton>
                  <IconButton
                    onClick={() => {
                      setDeleteDialog(item);
                    }}
                  >
                    <DeleteIcon color="error" />
                  </IconButton>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handleClose}
          color="error"
          variant="contained"
          sx={{ textTransform: 'none' }}
        >
          {t('cancel')}
        </Button>
      </DialogActions>

      {editDialog && (
        <EditDialog
          currentName={editDialog.name}
          title={t('edit')}
          handleClose={() => {
            setEditDialog(undefined);
          }}
          handleEdit={async (newName: string) => {
            await handleEditItem({ id: editDialog.id, name: newName });
          }}
        />
      )}

      {deleteDialog && (
        <DeleteDialog
          title={t('delete')}
          description={t('confirmProductSupplierDelete')}
          handleClose={() => {
            setDeleteDialog(undefined);
          }}
          handleDelete={async () => {
            await handleDeleteItem(deleteDialog.id);
            setDeleteDialog(undefined);
          }}
        />
      )}
    </Dialog>
  );
}
