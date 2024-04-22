import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';

interface EditCategoriesDialogProps {
  handleClose: () => void;
}

export default function EditCategoriesDialog({
  handleClose,
}: EditCategoriesDialogProps) {
  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle className="w-full flex justify-center">
        Edit Categories
      </DialogTitle>
      <DialogContent className="overflow-auto min-h-[600px] min-w-[600px]">
        asdf
      </DialogContent>
      <DialogActions>
        <Button variant="contained" color="error" onClick={handleClose}>
          Close
        </Button>
        <Button variant="contained">Submit</Button>
      </DialogActions>
    </Dialog>
  );
}
