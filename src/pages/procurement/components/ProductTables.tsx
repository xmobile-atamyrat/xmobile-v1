import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

export default function ProductTables() {
  //   const [searchKeyword, setSearchKeyword] = useState('');
  //   const { accessToken } = useUserContext();

  //   const handleSearch = useCallback(
  //     debounce(async (keyword: string) => {
  //       try {
  //         const { success, data, message } = await fetchWithCreds<
  //           ProcurementProduct[]
  //         >(
  //           accessToken,
  //           `/api/procurement/product?searchKeyword=${keyword}`,
  //           'GET',
  //         );
  //         if (success) {
  //           setTableData(processPrices(data));
  //         } else {
  //           setSnackbarOpen(true);
  //           setSnackbarMessage({
  //             message,
  //             severity: 'error',
  //           });
  //         }
  //       } catch (error) {
  //         console.error(error);
  //         setSnackbarOpen(true);
  //         setSnackbarMessage({
  //           message: 'fetchPricesError',
  //           severity: 'error',
  //         });
  //       }
  //     }, 300),
  //     [debounce, accessToken],
  //   );
  return (
    <Box className="flex flex-row h-full w-full min-h-[400px] gap-8 items-center">
      {/* Product list */}
      <Box className="flex flex-col h-full min-h-[400px] w-1/2 items-start">
        <TableContainer component={Paper}>
          <Table className="w-full h-full" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell align="center" colSpan={3}>
                  head
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>cell 1</TableCell>
                <TableCell>cell 2</TableCell>
                <TableCell>cell 3</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
      <Typography fontWeight={600} fontSize={24}>
        {'>'}
      </Typography>
      {/* Selected products */}
      <Box className="flex flex-col h-full w-1/2 min-h-[400px] items-start">
        asdf
      </Box>
    </Box>
  );
}
