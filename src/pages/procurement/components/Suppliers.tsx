import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import AddSupplierDialog from '@/pages/procurement/components/AddSupplierDialog';
import EditSupplierDialog from '@/pages/procurement/components/EditSupplierDialog';
import { fetchSuppliers } from '@/pages/procurement/lib/apis';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditIcon from '@mui/icons-material/Edit';
import { Box, IconButton, Typography } from '@mui/material';
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
  const [editSupplierDialog, setEditSupplierDialog] = useState(false);

  useEffect(() => {
    if (accessToken) {
      (async () => {
        const { success, data, message } = await fetchSuppliers(accessToken);
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

      <IconButton
        onClick={() => {
          setEditSupplierDialog(true);
        }}
      >
        <EditIcon color="primary" />
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

      {editSupplierDialog && (
        <EditSupplierDialog
          suppliers={suppliers}
          handleClose={() => {
            setEditSupplierDialog(false);
          }}
          setSnackbarMessage={setSnackbarMessage}
          setSnackbarOpen={setSnackbarOpen}
          setSuppliers={setSuppliers}
        />
      )}
    </Box>
  );
}
