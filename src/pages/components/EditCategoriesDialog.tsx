import { EditCategoriesProps } from '@/pages/lib/types';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  styled,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

interface EditCategoriesDialogProps {
  handleClose: () => void;
  whoOpened: EditCategoriesProps['whoOpened'];
}

export default function EditCategoriesDialog({
  handleClose,
  whoOpened,
}: EditCategoriesDialogProps) {
  return (
    <Dialog open onClose={handleClose}>
      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();

          // const jsonBytes = new FormData(event.target);
          // console.log(jsonBytes);
          // const jsonData = JSON.stringify(Object.entries(jsonBytes));
          // console.log(jsonData);
        }}
      >
        <DialogTitle className="w-full flex justify-center">
          {whoOpened === 'parent'
            ? 'Create new Category'
            : 'Edit or Create new Category'}
        </DialogTitle>
        <DialogContent className="overflow-auto min-h-[600px] min-w-[600px]">
          {whoOpened === 'parent' ? (
            <Box className="flex flex-col items-start justify-center gap-4">
              <TextField
                label="Category Name"
                name="categoryName"
                className="m-2 min-w-[250px]"
              />
              <Button
                component="label"
                role={undefined}
                variant="contained"
                tabIndex={-1}
                startIcon={<CloudUploadIcon />}
                sx={{ textTransform: 'none' }}
                className="m-2 min-w-[250px] h-[50px] text-[16px]"
              >
                Upload category image
                <VisuallyHiddenInput type="file" />
              </Button>
            </Box>
          ) : (
            <Box>
              <Typography>child opened</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" color="error" onClick={handleClose}>
            Close
          </Button>
          <Button variant="contained" type="submit">
            Submit
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
