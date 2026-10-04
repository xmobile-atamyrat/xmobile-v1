import dbClient from '@/lib/dbClient';
import type {
  AdminActivityAction,
  AdminActivityEntity,
  Prisma,
} from '@prisma/client';

export type AdminActivityInput = {
  userId: string | undefined | null;
  entity: AdminActivityEntity;
  action: AdminActivityAction;
  targetId?: string | null;
  meta?: Prisma.InputJsonObject;
};

/**
 * Awaitable variant, used by tests and by callers that already run off the
 * request path. It never rejects: an audit-log failure must not fail an admin's
 * save. `console.warn` (not `error`) keeps a logging hiccup out of Slack.
 */
export async function writeAdminActivity(
  input: AdminActivityInput,
): Promise<void> {
  if (!input.userId) return;
  try {
    const user = await dbClient.user.findUnique({
      where: { id: input.userId },
      select: { name: true },
    });
    if (!user) return;

    await dbClient.adminActivity.create({
      data: {
        userId: input.userId,
        userName: user.name,
        entity: input.entity,
        action: input.action,
        targetId: input.targetId ?? null,
        meta: input.meta,
      },
    });
  } catch (error) {
    console.warn('[adminActivity] failed to record activity:', error);
  }
}

/**
 * Fire-and-forget: call this after the change has committed and do not await.
 * One call per admin decision, not per database write.
 */
export function logAdminActivity(input: AdminActivityInput): void {
  writeAdminActivity(input).catch(() => undefined);
}

export type FieldChange = {
  from: Prisma.InputJsonValue | null;
  to: Prisma.InputJsonValue | null;
};

const sameValue = (a: unknown, b: unknown): boolean => {
  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();
  if (typeof a === 'object' && a !== null && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return a === b;
};

/**
 * Fields of `keys` that were supplied in `next` and differ from `before`.
 * An empty result means the save changed nothing worth recording.
 */
export function changedFields(
  before: Record<string, unknown>,
  next: Record<string, unknown>,
  keys: string[],
): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {};
  keys.forEach((key) => {
    if (!(key in next) || next[key] === undefined) return;
    if (!sameValue(before[key], next[key])) {
      changes[key] = {
        from: (before[key] ?? null) as Prisma.InputJsonValue | null,
        to: next[key] as Prisma.InputJsonValue | null,
      };
    }
  });
  return changes;
}
