import BASE_URL from '@/lib/ApiEndpoints';
import { localeOptions } from '@/pages/lib/constants';
import {
  AddEditProductProps,
  EditCategoriesProps,
  ExtendedCategory,
  ResponseApi,
} from '@/pages/lib/types';
import { styled } from '@mui/material';
import { Product } from '@prisma/client';
import { Dispatch, SetStateAction } from 'react';

// check if the image url is a local image or a remote image
// if it is a local image, delete it from the server
// if it is a remote image, do nothing
// delete the category from the server
export async function deleteCategory(
  categoryId: string,
  url: string | null | undefined,
): Promise<boolean> {
  try {
    if (url != null) new URL(url);
  } catch (_) {
    const { success: imgSuccess }: ResponseApi = await (
      await fetch(`${BASE_URL}/api/localImage?imgUrl=${url}`, {
        method: 'DELETE',
      })
    ).json();
    if (!imgSuccess) {
      return false;
    }
  }
  const { success }: ResponseApi = await (
    await fetch(`${BASE_URL}/api/category?categoryId=${categoryId}`, {
      method: 'DELETE',
    })
  ).json();
  return success;
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

export const parseName = (name: string, locale: string) => {
  try {
    const parsedName = JSON.parse(name);
    let categoryName = parsedName[locale];
    if (categoryName == null || categoryName === '') {
      categoryName =
        parsedName.tk ?? parsedName.ch ?? parsedName.ru ?? parsedName.en;
    }
    return categoryName;
  } catch (_) {
    return name;
  }
};

export const addEditCategory = async ({
  type,
  formJson,
  categoryImageUrl,
  categoryImageFile,
  selectedCategoryId,
  setCategories,
  errorMessage,
}: {
  type: EditCategoriesProps['dialogType'];
  formJson: { [k: string]: FormDataEntryValue };
  categoryImageUrl: string | undefined;
  categoryImageFile: File | undefined;
  selectedCategoryId: string | undefined;
  setCategories: Dispatch<SetStateAction<ExtendedCategory[]>>;
  errorMessage: string;
}): Promise<string | null> => {
  const newFormData = new FormData();
  const {
    categoryNameInTurkmen,
    categoryNameInCharjov,
    categoryNameInRussian,
    categoryNameInEnglish,
  } = formJson;

  if (
    categoryNameInCharjov === '' &&
    categoryNameInEnglish === '' &&
    categoryNameInRussian === '' &&
    categoryNameInTurkmen === ''
  ) {
    throw new Error(errorMessage);
  }
  const categoryNames: any = {};
  if (categoryNameInTurkmen !== '') categoryNames.tk = categoryNameInTurkmen;
  if (categoryNameInCharjov !== '') categoryNames.ch = categoryNameInCharjov;
  if (categoryNameInRussian !== '') categoryNames.ru = categoryNameInRussian;
  if (categoryNameInEnglish !== '') categoryNames.en = categoryNameInEnglish;
  newFormData.append('name', JSON.stringify(categoryNames));

  if (categoryImageUrl != null && categoryImageUrl !== '') {
    newFormData.append('imageUrl', categoryImageUrl);
  } else if (categoryImageFile != null && categoryImageFile.name !== '') {
    const resizedImage = await resizeImage(categoryImageFile, 240);
    newFormData.append('imageUrl', resizedImage);
  }

  if (type === 'add') {
    if (selectedCategoryId != null)
      newFormData.append('predecessorId', selectedCategoryId);
    await fetch(`${BASE_URL}/api/category`, {
      method: 'POST',
      body: newFormData,
    });
  } else {
    await fetch(`${BASE_URL}/api/category?categoryId=${selectedCategoryId}`, {
      method: 'PUT',
      body: newFormData,
    });
  }

  const {
    success: catSuccess,
    data: categories,
  }: ResponseApi<ExtendedCategory[]> = await (
    await fetch(`${BASE_URL}/api/category`)
  ).json();

  if (catSuccess && categories) {
    setCategories(categories);
    return categories[0]?.id;
  }

  return null;
};

export async function addProduct({
  type,
  formJson: {
    productNameInCharjov,
    productNameInEnglish,
    productNameInRussian,
    productNameInTurkmen,
    productDescriptionInCharjov,
    productDescriptionInEnglish,
    productDescriptionInRussian,
    productDescriptionInTurkmen,
    price,
  },
  productNameRequiredError,
  selectedCategoryId,
  setProducts,
  productImageUrl,
  productImageFile,
  selectedProductId,
}: {
  type: AddEditProductProps['dialogType'];
  formJson: { [k: string]: FormDataEntryValue };
  productNameRequiredError: string;
  selectedCategoryId: string;
  productImageUrl?: string;
  productImageFile?: File;
  setProducts: Dispatch<SetStateAction<Product[]>>;
  selectedProductId?: string;
}) {
  if (
    productNameInCharjov === '' &&
    productNameInEnglish === '' &&
    productNameInRussian === '' &&
    productNameInTurkmen === ''
  ) {
    throw new Error(productNameRequiredError);
  }

  const productNames: any = {};
  if (productNameInTurkmen !== '') productNames.tk = productNameInTurkmen;
  if (productNameInCharjov !== '') productNames.ch = productNameInCharjov;
  if (productNameInRussian !== '') productNames.ru = productNameInRussian;
  if (productNameInEnglish !== '') productNames.en = productNameInEnglish;

  const productDescriptions: any = {};
  if (productDescriptionInTurkmen !== '')
    productDescriptions.tk = productDescriptionInTurkmen;
  if (productDescriptionInCharjov !== '')
    productDescriptions.ch = productDescriptionInCharjov;
  if (productDescriptionInRussian !== '')
    productDescriptions.ru = productDescriptionInRussian;
  if (productDescriptionInEnglish !== '')
    productDescriptions.en = productDescriptionInEnglish;

  const newFormData = new FormData();

  newFormData.append('name', JSON.stringify(productNames));
  newFormData.append('categoryId', selectedCategoryId);

  if (Object.keys(productDescriptions).length > 0)
    newFormData.append('description', JSON.stringify(productDescriptions));
  if (price) newFormData.append('price', price);

  if (productImageUrl != null && productImageUrl !== '') {
    newFormData.append('imageUrl', productImageUrl);
  } else if (productImageFile != null && productImageFile?.name !== '') {
    const resizedImage = await resizeImage(productImageFile, 240);
    newFormData.append('imageUrl', resizedImage);
  }

  if (type === 'add') {
    await fetch(`${BASE_URL}/api/product`, {
      method: 'POST',
      body: newFormData,
    });
  } else {
    await fetch(`${BASE_URL}/api/product?productId=${selectedProductId}`, {
      method: 'PUT',
      body: newFormData,
    });
  }

  const { success, data }: ResponseApi<Product[]> = await (
    await fetch(`${BASE_URL}/api/product?categoryId=${selectedCategoryId}`)
  ).json();
  if (success && data != null) setProducts(data);
}
