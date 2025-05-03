import { SearchBar } from '@/pages/components/Appbar';
import { ProductsSuppliersType } from '@/pages/procurement/lib/types';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
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
  handleAddItem: (keyword: string) => Promise<void>;
  handleAddSearchedItem: (item: ProcurementProduct | Supplier) => void;
}

export default function AddProductsSuppliersDialog({
  handleClose,
  itemType,
  handleItemSearch,
  searchedItems,
  selectedItems,
  handleAddItem,
  handleAddSearchedItem,
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
            <Button
              sx={{ textTransform: 'none' }}
              variant="outlined"
              onClick={async () => {
                await handleAddItem(searchItemKeyword);
              }}
            >
              {t('add')}
            </Button>
          </Box>

          <Box className="flex flex-col gap-2 pl-4">
            {searchedItems.map((item) => (
              <Box key={item.id} className="flex flex-row items-center gap-8">
                <Typography className="h-[40px] flex items-center">
                  {item.name}
                </Typography>
                {selectedItems.some((i) => i.id === item.id) ? (
                  <Typography
                    color="green"
                    fontSize={12}
                    className="h-[40px] flex items-center"
                  >
                    {t('alreadyExists')}
                  </Typography>
                ) : (
                  <IconButton onClick={() => handleAddSearchedItem(item)}>
                    <AddCircleIcon color="primary" />
                  </IconButton>
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
