import { BANNER_IMAGE_HEIGHT, BANNER_IMAGE_WIDTH } from '@/pages/lib/constants';

export function bannerCropSize(
  sourceWidth: number,
  sourceHeight: number,
): { width: number; height: number } {
  const ratio = BANNER_IMAGE_WIDTH / BANNER_IMAGE_HEIGHT;
  let width = Math.min(sourceWidth, BANNER_IMAGE_WIDTH);
  let height = Math.round(width / ratio);
  if (height > sourceHeight) {
    height = sourceHeight;
    width = Math.round(height * ratio);
  }
  return { width, height };
}
