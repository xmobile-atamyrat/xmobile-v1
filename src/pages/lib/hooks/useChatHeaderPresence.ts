import { useChatContext } from '@/pages/lib/ChatContext';
import { useTranslations } from 'next-intl';

export interface ChatHeaderPresence {
  /** A conversation is open, as opposed to the admin session list. */
  inSession: boolean;
  /**
   * The header has a subject at all. False only for an admin on the session
   * list, who is looking at a queue rather than at a person -- there is no
   * avatar to hang a dot on and nobody whose presence would be meaningful.
   */
  showPresence: boolean;
  /**
   * The subject is online *and* we can currently hear the server. Callers can
   * render this directly; the "are we even connected" qualifier is already
   * folded in, because a cached `true` we can no longer verify is a lie.
   */
  online: boolean;
  /** Localised status line, distinguishing "we cannot tell" from "not here". */
  statusLabel: string;
  title: string;
}

/**
 * The subject of a chat header is never the viewer -- it is whoever sits on
 * the other end -- and who that is depends on the audience. A customer's
 * header is titled "Customer Support" and is about the desk as a whole; an
 * admin inside a conversation is looking at one named customer. Both surfaces
 * originally rendered `isConnected`, the viewer's own socket, which is why
 * every customer appeared online for as long as the page stayed open.
 *
 * Shared by the floating widget and the full /chat page. The chrome around it
 * differs, but the presence question is identical, and two hand-maintained
 * copies is how they started drifting apart in the first place.
 */
export function useChatHeaderPresence(isAdmin: boolean): ChatHeaderPresence {
  const t = useTranslations();
  const { isConnected, onlineUserIds, isSupportOnline, currentSession } =
    useChatContext();

  const inSession = currentSession != null;

  // Only admins resolve a specific peer: `onlineUserIds` is populated for
  // admins alone, so a customer asking it about anyone would read offline.
  const peer = isAdmin
    ? currentSession?.users?.find((u) => u.grade === 'FREE')
    : undefined;

  const peerOnline = isAdmin
    ? peer != null && onlineUserIds.has(peer.id)
    : isSupportOnline;

  // A dropped socket is ignorance, not absence: we cannot hear the server, so
  // claiming the other party is offline would be inventing information. The
  // status line says "connecting"; the dot simply does not render.
  const online = isConnected && peerOnline;

  const statusLabel = !isConnected
    ? t('chatConnecting')
    : t(online ? 'chatOnline' : 'chatOffline');

  let title: string;
  if (inSession && isAdmin) {
    title = peer?.name || t('chatGuest');
  } else if (isAdmin) {
    title = t('chatAdminDashboard');
  } else {
    title = t('chatCustomerSupport');
  }

  return {
    inSession,
    showPresence: !isAdmin || inSession,
    online,
    statusLabel,
    title,
  };
}
