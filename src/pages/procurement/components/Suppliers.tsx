import { fetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import AddSupplierDialog from '@/pages/procurement/components/AddSupplierDialog';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { Box, IconButton, Typography } from '@mui/material';
import { Supplier } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

export default function Suppliers() {
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
          // properly handle error message by showing the user alerts
          console.error(message);
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
        />
      )}
    </Box>
  );
}
