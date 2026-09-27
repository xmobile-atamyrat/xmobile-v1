import { usePlatform } from '@/pages/lib/PlatformContext';
import Badge from '@mui/material/Badge';
import { ReactNode } from 'react';

interface CountBadgeProps {
  count: number;
  children: ReactNode;
}

export default function CountBadge({ count, children }: CountBadgeProps) {
  const platform = usePlatform();

  return (
    <Badge
      badgeContent={count > 99 ? '99+' : count}
      color="error"
      sx={{
        '& .MuiBadge-badge': {
          backgroundColor: '#E41E2B',
          fontSize: platform === 'web' ? '11px' : '9px',
          fontWeight: 700,
          minWidth: platform === 'web' ? '18px' : '16px',
          height: platform === 'web' ? '18px' : '16px',
          padding: '0 4px',
        },
      }}
    >
      {children}
    </Badge>
  );
}
