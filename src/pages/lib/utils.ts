import BASE_URL from '@/lib/ApiEndpoints';
import { localeOptions } from '@/pages/lib/constants';
import { ResponseApi } from '@/pages/lib/types';
import { styled } from '@mui/material';

export async function deleteCategory(
  categoryId: string,
  url: string,
): Promise<boolean> {
  try {
    new URL(url);
    return true;
  } catch (_) {
    const { success: imgSuccess }: ResponseApi = await (
      await fetch(`${BASE_URL}/api/categoryImage?imgUrl=${url}`, {
        method: 'DELETE',
      })
    ).json();
    if (imgSuccess) {
      const { success }: ResponseApi = await (
        await fetch(`${BASE_URL}/api/category?categoryId=${categoryId}`, {
          method: 'DELETE',
        })
      ).json();
      return success;
    }
    return false;
  }
}

export const VisuallyHiddenInput = styled('input')({
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

export async function resizeImage(image: File, width: number): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const originalRatio = img.height / img.width;
      const height = width * originalRatio;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        resolve(blob as Blob);
      });
    };
    img.src = URL.createObjectURL(image);
  });
}

export const changeLocale = (
  newLocale: string,
  query: string,
  pathname: string,
) => {
  const pathSegments = pathname.split('/');
  if (localeOptions.includes(pathSegments[1])) {
    pathSegments[1] = newLocale;
  } else {
    pathSegments.splice(1, 0, newLocale);
  }
  const newPathname = pathSegments.join('/');
  const newUrl = `${newPathname}${query}`;

  return newUrl;
};

export const parseCategoryName = (name: string, locale: string) => {
  try {
    const parsedName = JSON.parse(name);
    let categoryName = parsedName[locale];
    if (categoryName == null) {
      categoryName =
        parsedName.tk ?? parsedName.ch ?? parsedName.ru ?? parsedName.en;
    }
    return categoryName;
  } catch (_) {
    return name;
  }
};
