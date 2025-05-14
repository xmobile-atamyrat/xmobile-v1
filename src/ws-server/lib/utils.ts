import { ChatMessageProps } from '@/pages/lib/types';
import { AuthenticatedConnection } from '@/ws-server/lib/types';

export function sendMessage(
  safeConnection: AuthenticatedConnection,
  message: ChatMessageProps,
) {
  if (safeConnection.readyState !== WebSocket.OPEN) {
    return;
  }

  safeConnection.send(JSON.stringify(message));
}
