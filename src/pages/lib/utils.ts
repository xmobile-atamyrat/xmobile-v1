import BASE_URL from '@/lib/ApiEndpoints';
import { ResponseApi } from '@/pages/lib/types';

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
