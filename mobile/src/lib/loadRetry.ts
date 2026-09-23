import {
  classifyWebViewError,
  LOAD_DEADLINE_ERROR,
  WebViewErrorDetail,
} from './webviewErrors';

export const MAX_AUTO_RETRIES = 3;
export const RETRY_BASE_DELAY_MS = 1000;
export const RETRY_MAX_DELAY_MS = 8000;
export const LOAD_DEADLINE_MS = 10000;

export type LoadRetryHandlers = {
  reload: (hasCommitted: boolean) => void;
  setRetrying: (isRetrying: boolean) => void;
  setError: (detail: WebViewErrorDetail | null) => void;
};

export type LoadRetryConfig = {
  maxAutoRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  deadlineMs: number;
};

export type LoadRetryController = {
  handleLoadStart: () => void;
  handleLoadEnd: () => void;
  handleError: (detail: WebViewErrorDetail) => void;
  retry: () => void;
  retryOnReconnect: () => void;
  hasCommitted: () => boolean;
  dispose: () => void;
};

export function createLoadRetryController(
  handlers: LoadRetryHandlers,
  config: Partial<LoadRetryConfig> = {},
): LoadRetryController {
  const {
    maxAutoRetries = MAX_AUTO_RETRIES,
    baseDelayMs = RETRY_BASE_DELAY_MS,
    maxDelayMs = RETRY_MAX_DELAY_MS,
    deadlineMs = LOAD_DEADLINE_MS,
  } = config;

  let retryCount = 0;
  let committed = false;
  let expectingLoad = true;
  let lastError: WebViewErrorDetail | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  let commitTimer: ReturnType<typeof setTimeout> | null = null;

  const clearRetryTimer = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const clearDeadline = () => {
    if (deadlineTimer) {
      clearTimeout(deadlineTimer);
      deadlineTimer = null;
    }
  };

  const clearCommit = () => {
    if (commitTimer) {
      clearTimeout(commitTimer);
      commitTimer = null;
    }
  };

  const commit = () => {
    commitTimer = null;
    committed = true;
    expectingLoad = false;
    retryCount = 0;
    lastError = null;
    clearRetryTimer();
    clearDeadline();
    handlers.setRetrying(false);
    handlers.setError(null);
  };

  const fail = (detail: WebViewErrorDetail) => {
    expectingLoad = false;
    clearRetryTimer();
    clearDeadline();
    handlers.setRetrying(false);
    handlers.setError(detail);
  };

  const startLoad = (resetBudget: boolean) => {
    clearCommit();
    clearRetryTimer();
    clearDeadline();
    if (resetBudget) {
      retryCount = 0;
    }
    lastError = null;
    expectingLoad = true;
    handlers.setError(null);
    handlers.setRetrying(true);
    handlers.reload(committed);
  };

  return {
    handleLoadStart: () => {
      if (!expectingLoad || deadlineTimer) {
        return;
      }
      deadlineTimer = setTimeout(() => {
        deadlineTimer = null;
        fail(lastError ?? LOAD_DEADLINE_ERROR);
      }, deadlineMs);
    },

    handleLoadEnd: () => {
      clearCommit();
      commitTimer = setTimeout(commit, 0);
    },

    handleError: (detail: WebViewErrorDetail) => {
      const kind = classifyWebViewError(detail);
      if (kind === 'ignore') {
        return;
      }

      clearCommit();
      lastError = detail;

      if (kind === 'transient' && retryCount < maxAutoRetries) {
        const delay = Math.min(baseDelayMs * 2 ** retryCount, maxDelayMs);
        retryCount += 1;
        expectingLoad = true;
        clearRetryTimer();
        handlers.setRetrying(true);
        retryTimer = setTimeout(() => {
          retryTimer = null;
          handlers.reload(committed);
        }, delay);
        return;
      }

      fail(detail);
    },

    retry: () => startLoad(true),

    retryOnReconnect: () => startLoad(false),

    hasCommitted: () => committed,

    dispose: () => {
      clearCommit();
      clearRetryTimer();
      clearDeadline();
    },
  };
}
