import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect('/workspaces');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  else redirect('/sign-in' as any);
}
