import { SearchBar } from '@/pages/components/Appbar';
import DeleteDialog from '@/pages/components/DeleteDialog';
import { SnackbarProps } from '@/pages/lib/types';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ProcurementProduct, Supplier } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction, useState } from 'react';

interface DualTablesProps {
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  items: (ProcurementProduct | Supplier)[];
  selectedItems: ProcurementProduct[];
  setSelectedItems: Dispatch<SetStateAction<ProcurementProduct[]>>;
  handleSearch: (...args: any[]) => void;
  createItem: (keyword: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
}

export default function DualTables({
  setSnackbarMessage,
  setSnackbarOpen,
  items,
  selectedItems,
  setSelectedItems,
  handleSearch,
  createItem,
  deleteItem,
}: DualTablesProps) {
  const [searchKeyword, setSearchKeyword] = useState('');

  const t = useTranslations();
  const [removeSelected, setRemoveSelected] = useState<string>();

  return (
    <Box className="flex flex-row w-full gap-8 items-center">
      {/* Product list */}
      <Box className="flex flex-col h-[500px] w-1/2 items-start">
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
                        await createItem(searchKeyword);
                      }}
                    >
                      {t('add')}
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell
                    onClick={() => {
                      if (selectedItems.some((p) => p.id === item.id)) {
                        setSnackbarMessage({
                          message: 'productAlreadySelected',
                          severity: 'error',
                        });
                        setSnackbarOpen(true);
                        return;
                      }
                      setSelectedItems([...selectedItems, item]);
                    }}
                  >
                    {item.name}
                  </TableCell>
                  <TableCell align="right" className="w-10">
                    <IconButton
                      className="p-0"
                      onClick={async () => {
                        await deleteItem(item.id);
                      }}
                    >
                      <DeleteIcon color="error" />
                    </IconButton>
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
      <Box className="flex flex-col h-[500px] w-1/2 items-start">
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell colSpan={3}>
                  <Box className="flex flex-row gap-4 items-center w-full justify-between">
                    <Typography fontWeight={600} fontSize={16}>
                      {t('selectedItems')}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {selectedItems.map(({ name, id }) => (
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
          blueButtonText={t('cancel')}
          redButtonText={t('remove')}
          handleClose={() => setRemoveSelected(undefined)}
          handleDelete={async () => {
            setSelectedItems(
              selectedItems.filter((product) => product.id !== removeSelected),
            );
            setRemoveSelected(undefined);
          }}
        />
      )}
    </Box>
  );
}
