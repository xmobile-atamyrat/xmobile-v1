import { UserRole } from '@prisma/client';
import { WebSocket } from 'ws';

export interface AuthenticatedConnection extends WebSocket {
  userId: string;
  userGrade: UserRole;
  /**
   * Liveness flag driven by the server's ping/pong sweep. Set false just
   * before each ping goes out and back to true when the peer's pong lands; a
   * connection still false on the next sweep is presumed dead and terminated.
   *
   * Without it a socket killed at the network layer -- phone into a tunnel,
   * laptop lid closed -- sits in the maps until TCP finally gives up, which
   * can be minutes, and reports that user as online the whole time.
   */
  isAlive?: boolean;
}
