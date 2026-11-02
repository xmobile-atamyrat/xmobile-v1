import { UserRole } from '@prisma/client';

export const ROLE_LABEL_KEYS: Record<UserRole, string> = {
  FREE: 'roleFree',
  ADMIN: 'roleAdmin',
  SUPERUSER: 'roleSuperuser',
};

export const USER_ROLES = Object.values(UserRole);

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  grade: UserRole;
  createdAt: string;
};

export type ManagedUserPage = {
  items: ManagedUser[];
  nextCursor: string | null;
};
