import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import mockRouter from 'next-router-mock';
import { afterEach, expect, vi } from 'vitest';

expect.extend(matchers);

vi.mock('next/router', async () => import('next-router-mock'));

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as MediaQueryList,
  });
}

afterEach(() => {
  cleanup();
  mockRouter.reset();
});
