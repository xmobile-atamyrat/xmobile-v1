import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUserFind, mockCreate } = vi.hoisted(() => ({
  mockUserFind: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock('@/lib/dbClient', () => ({
  default: {
    user: { findUnique: mockUserFind },
    adminActivity: { create: mockCreate },
  },
}));

import {
  changedFields,
  logAdminActivity,
  writeAdminActivity,
} from '@/lib/adminActivity';

describe('writeAdminActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFind.mockResolvedValue({ name: 'Aman' });
    mockCreate.mockResolvedValue({});
  });

  it('stores the actor name snapshot with the row', async () => {
    await writeAdminActivity({
      userId: 'u1',
      entity: 'BRAND',
      action: 'CREATE',
      targetId: 'b1',
      meta: { name: 'Apple' },
    });

    expect(mockUserFind).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { name: true },
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        userName: 'Aman',
        entity: 'BRAND',
        action: 'CREATE',
        targetId: 'b1',
        meta: { name: 'Apple' },
      },
    });
  });

  it('skips when there is no actor id', async () => {
    await writeAdminActivity({
      userId: undefined,
      entity: 'BRAND',
      action: 'CREATE',
    });
    expect(mockUserFind).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('skips when the actor no longer exists', async () => {
    mockUserFind.mockResolvedValue(null);
    await writeAdminActivity({
      userId: 'gone',
      entity: 'BRAND',
      action: 'DELETE',
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('never throws when the write fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockCreate.mockRejectedValue(new Error('db down'));

    await expect(
      writeAdminActivity({ userId: 'u1', entity: 'COLOR', action: 'UPDATE' }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('logAdminActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFind.mockResolvedValue({ name: 'Aman' });
    mockCreate.mockResolvedValue({});
  });

  it('returns synchronously without waiting for the write', () => {
    mockCreate.mockReturnValue(new Promise(() => {}));
    const result = logAdminActivity({
      userId: 'u1',
      entity: 'BRAND',
      action: 'CREATE',
    });
    expect(result).toBeUndefined();
  });

  it('does not throw synchronously when the lookup rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockUserFind.mockRejectedValue(new Error('boom'));
    expect(() =>
      logAdminActivity({ userId: 'u1', entity: 'BRAND', action: 'CREATE' }),
    ).not.toThrow();
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    warn.mockRestore();
  });
});

describe('changedFields', () => {
  it('returns only fields whose value differs', () => {
    expect(
      changedFields(
        { name: 'a', price: 1, stock: 3 },
        { name: 'a', price: 2 },
        ['name', 'price', 'stock'],
      ),
    ).toEqual({ price: { from: 1, to: 2 } });
  });

  it('ignores keys missing from the next value', () => {
    expect(changedFields({ name: 'a' }, {}, ['name'])).toEqual({});
  });

  it('compares dates and objects by value', () => {
    expect(
      changedFields(
        { at: new Date('2026-01-01'), tags: ['a'] },
        { at: new Date('2026-01-01'), tags: ['a'] },
        ['at', 'tags'],
      ),
    ).toEqual({});
    expect(
      changedFields({ tags: ['a'] }, { tags: ['a', 'b'] }, ['tags']),
    ).toEqual({ tags: { from: ['a'], to: ['a', 'b'] } });
  });
});
