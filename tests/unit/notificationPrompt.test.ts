import {
  isPromptDue,
  NOTIFICATION_PROMPT_COOLDOWN_MS,
  NOTIFICATION_PROMPT_MAX_DECLINES,
} from '@/pages/lib/notificationPrompt';
import { describe, expect, it } from 'vitest';

const now = 1_800_000_000_000;

describe('isPromptDue', () => {
  it('offers the welcome prompt once per device, signed in or not', () => {
    expect(isPromptDue('welcome', {}, { signedIn: false, now })).toBe(true);
    expect(isPromptDue('welcome', {}, { signedIn: true, now })).toBe(true);
    expect(
      isPromptDue('welcome', { welcomeSeen: true }, { signedIn: true, now }),
    ).toBe(false);
  });

  it('never offers order/chat prompts to guests', () => {
    expect(isPromptDue('order', {}, { signedIn: false, now })).toBe(false);
    expect(isPromptDue('chat', {}, { signedIn: false, now })).toBe(false);
  });

  it('waits out the cooldown after the last check', () => {
    const justChecked = { lastCheckedAt: now - 1000 };
    expect(isPromptDue('order', justChecked, { signedIn: true, now })).toBe(
      false,
    );
    const longAgo = { lastCheckedAt: now - NOTIFICATION_PROMPT_COOLDOWN_MS };
    expect(isPromptDue('chat', longAgo, { signedIn: true, now })).toBe(true);
  });

  it('stops asking after too many "Not now"s', () => {
    const state = { declines: NOTIFICATION_PROMPT_MAX_DECLINES };
    expect(isPromptDue('order', state, { signedIn: true, now })).toBe(false);
  });
});
