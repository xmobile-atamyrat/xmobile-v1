import { fetchWithCreds } from '@/pages/lib/fetch';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import AddSupplierDialog from '@/pages/procurement/components/AddSupplierDialog';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { Box, IconButton, Typography } from '@mui/material';
import { Supplier } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';

interface SuppliersProps {
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
}

export default function Suppliers({
  setSnackbarMessage,
  setSnackbarOpen,
}: SuppliersProps) {
  const t = useTranslations();
  const [suppliers, setSuppliers] = useState([]);
  const { accessToken } = useUserContext();
  const [addSupplierDialog, setAddSupplierDialog] = useState(false);

  useEffect(() => {
    if (accessToken) {
      (async () => {
        const { success, data, message } = await fetchWithCreds<Supplier[]>(
          accessToken,
          '/api/procurement/supplier',
          'GET',
        );
        if (success) {
          setSuppliers(data);
        } else {
          console.error(message);
          setSnackbarOpen(true);
          setSnackbarMessage({ message: 'serverError', severity: 'error' });
        }
      })();
    }
  }, [accessToken]);
  return (
    <Box className="w-full h-full flex flex-row">
      <Box className="flex items-center">
        <Typography fontWeight={600}>{`${t('suppliers')}: `}</Typography>
      </Box>
      <Box className="flex flex-row px-2">
        {suppliers.map(({ id, name }, idx) => (
          <Box key={id} className="px-2 flex items-center">
            {idx === suppliers.length - 1 ? (
              <Typography>{name}</Typography>
            ) : (
              <Typography>{`${name}, `}</Typography>
            )}
          </Box>
        ))}
      </Box>
      <IconButton
        onClick={() => {
          setAddSupplierDialog(true);
        }}
      >
        <AddCircleIcon color="primary" />
      </IconButton>

      {addSupplierDialog && (
        <AddSupplierDialog
          handleClose={() => {
            setAddSupplierDialog(false);
          }}
          setSuppliers={setSuppliers}
          setSnackbarMessage={setSnackbarMessage}
          setSnackbarOpen={setSnackbarOpen}
        />
      )}
    </Box>
  );
}
