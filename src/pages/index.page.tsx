import { ResponseApi } from '@/pages/lib/types';
import { User } from '@prisma/client';
import { GetStaticProps, InferGetServerSidePropsType } from 'next';

export const getStaticProps = (async () => {
  const { success, data: user }: ResponseApi<User> = await (
    await fetch('http://localhost:3000/api/user')
  ).json();
  if (success) return { props: { user } };
  return { props: {} };
}) satisfies GetStaticProps<{
  user?: User;
}>;

export default function Home({
  user,
}: InferGetServerSidePropsType<typeof getStaticProps>) {
  return <div>{user?.name}</div>;
}
