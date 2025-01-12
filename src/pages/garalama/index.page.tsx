import React from 'react';
import { Paper, Typography } from '@mui/material';

const MyPaperComponent = () => {
  return (
    <Paper elevation={3} className="p-4">
      <Typography variant="h5">Hello, Paper!</Typography>
      <Typography variant="body1">
        This is a basic Paper component in Material-UI.
      </Typography>
    </Paper>
  );
};

export default MyPaperComponent;
