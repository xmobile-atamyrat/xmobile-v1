import { UserRole } from '@prisma/client';
import { WebSocket } from 'ws';

export interface AuthenticatedConnection extends WebSocket {
  userId: string;
  userGrade: UserRole;
}
