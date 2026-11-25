import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Box, Tooltip } from '@mui/material';

interface SaleFeedbackProps {
  /** Null for an empty cell; a null percent is a sale price that cannot apply. */
  feedback: { percent: number | null } | null;
  errorText: string;
}

// Drawn over the cell's padding, so it never moves the text being edited or
// changes the row height. The parent cell must be `relative`.
export default function SaleFeedback({
  feedback,
  errorText,
}: SaleFeedbackProps) {
  if (feedback == null) return null;

  if (feedback.percent != null) {
    return (
      <Box
        component="span"
        sx={{
          position: 'absolute',
          left: 16,
          bottom: 1,
          px: 0.5,
          borderRadius: 1,
          bgcolor: 'error.main',
          color: 'error.contrastText',
          fontSize: 11,
          fontWeight: 700,
          lineHeight: '14px',
          pointerEvents: 'none',
        }}
      >
        {`-${feedback.percent}%`}
      </Box>
    );
  }

  return (
    <>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          border: '2px solid',
          borderColor: 'error.main',
          pointerEvents: 'none',
        }}
      />
      <Tooltip title={errorText} enterTouchDelay={0}>
        <ErrorOutlineIcon
          color="error"
          sx={{ position: 'absolute', right: 4, top: 4, fontSize: 16 }}
        />
      </Tooltip>
    </>
  );
}
