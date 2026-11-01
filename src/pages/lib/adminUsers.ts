import { UserRole } from '@prisma/client';

/** `STAFF` is ADMIN + SUPERUSER, the Roles tab's default view. */
export const ROLE_FILTERS = [
  'STAFF',
  'ALL',
  'FREE',
  'ADMIN',
  'SUPERUSER',
] as const;
export type RoleFilter = (typeof ROLE_FILTERS)[number];

export const ROLE_FILTER_LABEL_KEYS: Record<RoleFilter, string> = {
  STAFF: 'rolesFilterStaff',
  ALL: 'rolesFilterAll',
  FREE: 'roleFree',
  ADMIN: 'roleAdmin',
  SUPERUSER: 'roleSuperuser',
};

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
