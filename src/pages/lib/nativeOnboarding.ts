import { isWebView } from './serviceWorker';

let onboardingActive: boolean | null = null;
const listeners = new Set<() => void>();

function parseMessage(raw: unknown): any {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', (event: MessageEvent) => {
    const data = parseMessage(event.data);
    if (data?.type !== 'ONBOARDING_STATE') return;
    onboardingActive = !!data.payload?.active;
    listeners.forEach((listener) => listener());
  });
}

export function afterNativeOnboarding(
  callback: () => void,
  fallbackMs: number,
): () => void {
  if (!isWebView() || onboardingActive === false) {
    callback();
    return () => {};
  }

  let done = false;
  let fallback: ReturnType<typeof setTimeout> | undefined;
  let onChange: () => void = () => {};
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(fallback);
    listeners.delete(onChange);
    callback();
  };
  onChange = () => {
    if (onboardingActive === false) finish();
    else clearTimeout(fallback);
  };
  listeners.add(onChange);
  if (onboardingActive === null) fallback = setTimeout(finish, fallbackMs);

  return () => {
    done = true;
    clearTimeout(fallback);
    listeners.delete(onChange);
  };
}
