import { SearchBar } from '@/pages/components/Appbar';
import { ProductsSuppliersType } from '@/pages/procurement/lib/types';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
} from '@mui/material';
import { ProcurementProduct, Supplier } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface AddProductsSuppliersDialogProps {
  handleClose: () => void;
  itemType: ProductsSuppliersType;
  handleItemSearch: (keyword: string) => Promise<void>;
  searchedItems: (ProcurementProduct | Supplier)[];
  selectedItems: (ProcurementProduct | Supplier)[];
}

export default function AddProductsSuppliersDialog({
  handleClose,
  itemType,
  handleItemSearch,
  searchedItems,
  selectedItems,
}: AddProductsSuppliersDialogProps) {
  const t = useTranslations();
  const [searchItemKeyword, setSearchItemKeyword] = useState('');
  return (
    <Dialog open onClose={handleClose} fullScreen>
      <DialogTitle>
        {itemType === 'product' ? t('addProducts') : t('addSuppliers')}
      </DialogTitle>
      <DialogContent>
        <Box className="flex flex-col gap-4">
          <Box className="flex flex-row gap-2">
            {SearchBar({
              handleSearch: handleItemSearch,
              searchKeyword: searchItemKeyword,
              setSearchKeyword: setSearchItemKeyword,
              searchPlaceholder: t('search'),
              width: '100%',
            })}
            <Button sx={{ textTransform: 'none' }} variant="outlined">
              {t('add')}
            </Button>
          </Box>

          <Box className="flex flex-col gap-2">
            {searchedItems.map((item) => (
              <Box
                key={item.id}
                className="flex flex-row justify-between items-center"
              >
                <Box>{item.name}</Box>
                {selectedItems.includes(item) ? (
                  <IconButton>
                    <AddCircleIcon color="primary" />
                  </IconButton>
                ) : (
                  <CheckCircleOutlineIcon color="success" />
                )}
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
    </Dialog>
  );
}
