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
  entityId?: string | null;
  meta?: Prisma.InputJsonObject;
};

/**
 * Awaitable variant, used by tests and by callers that already run off the
 * request path. All rows go in one insert, with one name lookup however many
 * rows share an actor. It never rejects: an audit-log failure must not fail an
 * admin's save. `console.warn` (not `error`) keeps a logging hiccup out of
 * Slack.
 */
export async function writeAdminActivities(
  inputs: AdminActivityInput[],
): Promise<void> {
  const withActor = inputs.filter(
    (input): input is AdminActivityInput & { userId: string } =>
      Boolean(input.userId),
  );
  if (withActor.length === 0) return;
  try {
    const users = await dbClient.user.findMany({
      where: {
        id: { in: [...new Set(withActor.map((input) => input.userId))] },
      },
      select: { id: true, name: true },
    });
    const names = new Map(users.map((user) => [user.id, user.name]));

    const data = withActor.flatMap((input) => {
      const userName = names.get(input.userId);
      if (userName == null) return [];
      return [
        {
          userId: input.userId,
          userName,
          entity: input.entity,
          action: input.action,
          entityId: input.entityId ?? null,
          meta: input.meta,
        },
      ];
    });
    if (data.length === 0) return;

    await dbClient.adminActivity.createMany({ data });
  } catch (error) {
    console.warn('[adminActivity] failed to record activity:', error);
  }
}

export function writeAdminActivity(input: AdminActivityInput): Promise<void> {
  return writeAdminActivities([input]);
}

/**
 * Fire-and-forget: call this after the change has committed and do not await.
 * One row per admin decision, not per database write.
 */
export function logAdminActivities(inputs: AdminActivityInput[]): void {
  writeAdminActivities(inputs).catch(() => undefined);
}

export function logAdminActivity(input: AdminActivityInput): void {
  logAdminActivities([input]);
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
