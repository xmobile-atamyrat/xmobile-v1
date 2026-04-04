import { PrismaClient, UserRole } from '@prisma/client';

export type StaffPrincipal = {
  userId: string;
  accessToken: string;
};

/**
 * Creates a DB user with the given role and mints a JWT using the same secrets as integration tests.
 * Caller should delete the user when done (cascade cleans related rows where applicable).
 */
export async function createStaffPrincipal(
  prisma: PrismaClient,
  grade: UserRole,
): Promise<StaffPrincipal> {
  const user = await prisma.user.create({
    data: {
      email: `staff-${grade.toLowerCase()}-${Date.now()}@test.local`,
      name: `Staff ${grade}`,
      password: 'placeholder',
      grade,
    },
  });
  const { generateTokens } = await import('@/pages/api/utils/tokenUtils');
  const { accessToken } = generateTokens(user.id, grade);
  return { userId: user.id, accessToken };
}
