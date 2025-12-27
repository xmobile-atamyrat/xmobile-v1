import dbClient from '@/lib/dbClient';
import { ChatMessageProps } from '@/pages/lib/types';
import { AuthenticatedConnection } from '@/ws-server/lib/types';
import { WebSocket } from 'ws';

export function sendMessage(
  safeConnection: AuthenticatedConnection,
  message: ChatMessageProps,
) {
  if (safeConnection.readyState !== WebSocket.OPEN) {
    return;
  }

  safeConnection.send(JSON.stringify(message));
}

export async function verifySessionParticipant(
  sessionId: string,
  userId: string,
) {
  const session = await dbClient.chatSession.findFirst({
    where: {
      id: sessionId,
      users: { some: { id: userId } },
    },
    include: { users: true },
  });

  return session;
}
