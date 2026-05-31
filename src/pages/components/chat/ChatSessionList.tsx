import { useChatContext } from '@/pages/lib/ChatContext';
import { Platform, usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { TK_MONTHS_SHORT } from '@/pages/lib/constants';
import { ChatSession, ProtectedUser } from '@/pages/lib/types';
import { chatClasses } from '@/styles/classMaps/components/chat';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Badge,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

interface ChatSessionListProps {
  onSelectSession: (session: ChatSession) => void;
}

const formatLastActiveDate = (dateString: string, locale: string = 'en') => {
  const date = new Date(dateString);
  const now = new Date();

  // map 'ch' locale to 'tk' (Turkmen)
  const activeLocale = locale === 'ch' ? 'tk' : locale;

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString(activeLocale, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (date.getFullYear() === now.getFullYear()) {
    if (activeLocale === 'tk') {
      // for Turkmen, use custom short month names
      const month = TK_MONTHS_SHORT[date.getMonth()];
      const day = date.getDate();
      return `${month} ${day}`;
    }

    return date.toLocaleDateString(activeLocale, {
      month: 'short',
      day: 'numeric',
    });
  }

  // show full date for previous years
  return date.toLocaleDateString(activeLocale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const SessionListItem = ({
  session: chatSession,
  user,
  locale,
  platform,
  onClick,
}: {
  session: ChatSession;
  user: ProtectedUser | null;
  locale: string;
  platform: Platform;
  onClick: (session: ChatSession) => void;
}) => {
  const t = useTranslations();
  const sessionUser =
    chatSession.users?.find((u) => u.grade === 'FREE') ||
    chatSession.users?.[0];
  const userInfo = sessionUser
    ? `${sessionUser.name} (${sessionUser.email}${sessionUser.phoneNumber ? `, ${sessionUser.phoneNumber}` : ''})`
    : 'User';

  const lastMessage = chatSession.messages?.[0];
  const awaitingAdminReply = lastMessage?.senderRole === 'FREE';

  let senderName = '';
  if (lastMessage) {
    if (lastMessage.senderRole === 'FREE') {
      senderName = sessionUser ? sessionUser.name : t('chatGuest');
    } else if (lastMessage.senderId === user?.id) {
      senderName = t('chatYou');
    } else {
      senderName = t('chatCustomerSupport');
    }
  }

  const messageSnippet = lastMessage
    ? `${senderName}: ${lastMessage.content}`
    : '';

  const messageDate = lastMessage
    ? formatLastActiveDate(lastMessage.createdAt as string, locale)
    : formatLastActiveDate(chatSession.updatedAt as string, locale);

  return (
    <ListItemButton
      className={chatClasses.sessionList.listItem[platform]}
      onClick={() => onClick(chatSession)}
      sx={{
        '&:hover': { backgroundColor: '#F6F6F6' },
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '14px',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {userInfo}
        </Typography>
        <Typography
          sx={{
            fontSize: '12px',
            color: '#838383',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {messageSnippet}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 0.5,
          flexShrink: 0,
        }}
      >
        <Typography
          sx={{
            fontSize: '11px',
            color: '#838383',
          }}
        >
          {messageDate}
        </Typography>
        {awaitingAdminReply && (
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#ff624c',
            }}
          />
        )}
      </Box>
    </ListItemButton>
  );
};

const ChatSessionList = ({ onSelectSession }: ChatSessionListProps) => {
  const { user } = useUserContext();
  const { sessions, loadSessions } = useChatContext();
  const platform = usePlatform();
  const t = useTranslations();
  const router = useRouter();
  const locale = router.locale || 'en';

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  const openSessions = sessions.filter(
    (s) => s.status === 'PENDING' || s.status === 'ACTIVE',
  );
  const closedSessions = sessions.filter((s) => s.status === 'CLOSED');
  const isAdminOrSuperuser =
    user?.grade === 'SUPERUSER' || user?.grade === 'ADMIN';

  const handleSessionClick = (session: ChatSession) => {
    onSelectSession(session);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        backgroundColor: '#fff',
      }}
    >
      {/* Open Chats */}
      <Accordion
        defaultExpanded
        disableGutters
        elevation={0}
        sx={{ borderBottom: '1px solid #E6E6E6' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>
            {t('chatOpenChats')}
          </Typography>
          {openSessions.length > 0 && (
            <Badge
              badgeContent={openSessions.length}
              sx={{
                ml: 2,
                '& .MuiBadge-badge': {
                  backgroundColor: '#ff624c',
                  color: '#fff',
                  fontSize: '11px',
                },
              }}
            />
          )}
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}>
          <List disablePadding>
            {openSessions.length === 0 && (
              <ListItem>
                <ListItemText
                  secondary={t('chatNoActiveChats')}
                  secondaryTypographyProps={{
                    fontSize: '13px',
                    color: '#838383',
                  }}
                />
              </ListItem>
            )}
            {openSessions.map((session) => (
              <SessionListItem
                key={session.id}
                session={session}
                user={user}
                locale={locale}
                platform={platform}
                onClick={handleSessionClick}
              />
            ))}
          </List>
        </AccordionDetails>
      </Accordion>

      {/* Closed Chats */}
      {isAdminOrSuperuser && (
        <Accordion disableGutters elevation={0}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>
              {t('chatClosedChats')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            <List disablePadding>
              {closedSessions.length === 0 && (
                <ListItem>
                  <ListItemText
                    secondary={t('chatNoClosedChats')}
                    secondaryTypographyProps={{
                      fontSize: '13px',
                      color: '#838383',
                    }}
                  />
                </ListItem>
              )}
              {closedSessions.map((session) => (
                <SessionListItem
                  key={session.id}
                  session={session}
                  user={user}
                  locale={locale}
                  platform={platform}
                  onClick={handleSessionClick}
                />
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
};

export default ChatSessionList;
