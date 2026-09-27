export type NotificationPromptReason = 'welcome' | 'order' | 'chat';

export type NotificationPromptState = {
  welcomeSeen?: boolean;
  lastCheckedAt?: number;
  declines?: number;
};

export const NOTIFICATION_PROMPT_STATE_KEY = 'notif_prompt_state';
export const NOTIFICATION_PROMPT_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
export const NOTIFICATION_PROMPT_MAX_DECLINES = 3;

export function readPromptState(): NotificationPromptState {
  try {
    const raw = localStorage.getItem(NOTIFICATION_PROMPT_STATE_KEY);
    return raw ? (JSON.parse(raw) as NotificationPromptState) : {};
  } catch {
    return {};
  }
}

export function writePromptState(patch: NotificationPromptState): void {
  try {
    localStorage.setItem(
      NOTIFICATION_PROMPT_STATE_KEY,
      JSON.stringify({ ...readPromptState(), ...patch }),
    );
  } catch (error) {
    console.warn('[NotificationPrompt] Failed to save prompt state:', error);
  }
}

export function isPromptDue(
  reason: NotificationPromptReason,
  state: NotificationPromptState,
  { signedIn, now }: { signedIn: boolean; now: number },
): boolean {
  if (reason === 'welcome') return !state.welcomeSeen;
  if (!signedIn) return false;
  if ((state.declines ?? 0) >= NOTIFICATION_PROMPT_MAX_DECLINES) return false;
  return (
    state.lastCheckedAt === undefined ||
    now - state.lastCheckedAt >= NOTIFICATION_PROMPT_COOLDOWN_MS
  );
}
