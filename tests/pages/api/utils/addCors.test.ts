import type { NextApiResponse } from 'next';
import { describe, expect, it, vi } from 'vitest';

import addCors from '@/pages/api/utils/addCors';

describe('addCors', () => {
  it('sets CORS and noindex headers on the response', () => {
    const setHeader = vi.fn();
    const res = { setHeader } as unknown as NextApiResponse;

    addCors(res);

    expect(setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    expect(setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    );
    expect(setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Headers',
      'X-Requested-With, Content-Type, Accept',
    );
    expect(setHeader).toHaveBeenCalledWith('X-Robots-Tag', 'noindex');
  });
});
