import { useChatContext } from '@/pages/lib/ChatContext';
import { useEffect, useRef, useState } from 'react';

/**
 * Fires only on the transition to CLOSED. The closed session outlives the
 * component in ChatContext, and the widget remounts with every page's Layout,
 * so reacting to the state itself re-announced the closure on each navigation.
 */
export function useSessionClosedNotice(isAdmin: boolean) {
  const { currentSession } = useChatContext();
  const [open, setOpen] = useState(false);
  const previousRef = useRef(currentSession);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = currentSession;
    if (
      !isAdmin &&
      currentSession?.status === 'CLOSED' &&
      previous?.id === currentSession.id &&
      previous.status !== 'CLOSED'
    ) {
      setOpen(true);
    }
  }, [currentSession, isAdmin]);

  return { open, close: () => setOpen(false) };
}
