import { Platform } from '@/pages/lib/PlatformContext';

export const formatDate = (
  date: Date | string | null | undefined,
  platform: Platform,
) => {
  if (!date) return '-';
  const d = new Date(date);
  if (platform === 'mobile') {
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
