import BASE_URL from '@/lib/ApiEndpoints';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { ExtendedCategory, ResponseApi } from '@/pages/lib/types';
import { User } from '@prisma/client';
import { GetStaticProps, InferGetServerSidePropsType } from 'next';
import { useEffect } from 'react';

type ReturnProps = { user?: User; categories?: ExtendedCategory[] };

export const getStaticProps = (async () => {
  const { success: userSuccess, data: user }: ResponseApi<User> = await (
    await fetch(`${BASE_URL}/api/user`)
  ).json();
  const {
    success: catSuccess,
    data: categories,
  }: ResponseApi<ExtendedCategory[]> = await (
    await fetch(`${BASE_URL}/api/category`)
  ).json();

  const props: ReturnProps = {};
  if (userSuccess) props.user = user;
  if (catSuccess) props.categories = categories;
  return { props };
}) satisfies GetStaticProps<ReturnProps>;

export default function Home({
  user,
  categories,
}: InferGetServerSidePropsType<typeof getStaticProps>) {
  const { setCategories } = useCategoryContext();
  useEffect(() => {
    if (categories == null) return;
    setCategories(categories);
  }, [categories, setCategories]);
  return <div>{user?.name}</div>;
}
