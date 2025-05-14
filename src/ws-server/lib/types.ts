import { WebSocket } from 'ws';

export interface AuthenticatedConnection extends WebSocket {
  userId: string;
}
