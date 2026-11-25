import Badge from '@mui/material/Badge';
import { ReactNode } from 'react';

interface AttentionDotProps {
  show: boolean;
  /** Read out by screen readers while the dot shows. */
  label: string;
  children: ReactNode;
}

// A small red dot on the top-right corner of its child, like a new
// notification. Used to lead staff from the profile icon to Update Prices
// while any price is stale.
export default function AttentionDot({
  show,
  label,
  children,
}: AttentionDotProps) {
  return (
    <Badge
      variant="dot"
      invisible={!show}
      overlap="circular"
      slotProps={{
        badge: {
          role: show ? 'status' : undefined,
          'aria-label': show ? label : undefined,
        },
      }}
      sx={{
        '& .MuiBadge-dot': {
          backgroundColor: '#E41E2B',
          minWidth: 10,
          height: 10,
          borderRadius: '50%',
          border: '2px solid #fff',
          boxSizing: 'content-box',
        },
      }}
    >
      {children}
    </Badge>
  );
}
