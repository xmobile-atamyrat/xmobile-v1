export type BridgeMessage = { type?: string; payload?: any };

export function parseBridgeMessage(raw: unknown): BridgeMessage | null {
  if (typeof raw !== 'string') {
    return raw != null && typeof raw === 'object'
      ? (raw as BridgeMessage)
      : null;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed != null && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
