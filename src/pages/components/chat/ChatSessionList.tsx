import { useChatContext } from '@/pages/lib/ChatContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { ChatSession } from '@/pages/lib/types';
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
import { useEffect } from 'react';

interface ChatSessionListProps {
  onSelectSession: (session: ChatSession) => void;
}

const ChatSessionList = ({ onSelectSession }: ChatSessionListProps) => {
  const { user } = useUserContext();
  const { sessions, loadSessions } = useChatContext();
  const platform = usePlatform();
  const t = useTranslations();

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  const pendingSessions = sessions.filter((s) => s.status === 'PENDING');
  const activeSessions = sessions.filter((s) => s.status === 'ACTIVE');
  const closedSessions = sessions.filter((s) => s.status === 'CLOSED');
  const isSuperuser = user?.grade === 'SUPERUSER';

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
      {/* Pending Requests */}
      <Accordion
        defaultExpanded
        disableGutters
        elevation={0}
        sx={{ borderBottom: '1px solid #E6E6E6' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>
            {t('chatPendingRequests')}
          </Typography>
          {pendingSessions.length > 0 && (
            <Badge
              badgeContent={pendingSessions.length}
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
            {pendingSessions.length === 0 && (
              <ListItem>
                <ListItemText
                  secondary={t('chatNoPendingRequests')}
                  secondaryTypographyProps={{
                    fontSize: '13px',
                    color: '#838383',
                  }}
                />
              </ListItem>
            )}
            {pendingSessions.map((session) => {
              const sessionUser = session.users?.[0];
              const userInfo = sessionUser
                ? `${sessionUser.name} (${sessionUser.email}${sessionUser.phoneNumber ? `, ${sessionUser.phoneNumber}` : ''})`
                : 'Unknown User';
              const lastMessage = (session as any).messages?.[0];
              const hasUnread = lastMessage?.senderRole === 'FREE';
              return (
                <ListItemButton
                  key={session.id}
                  className={chatClasses.sessionList.listItem[platform]}
                  onClick={() => handleSessionClick(session)}
                  sx={{
                    '&:hover': { backgroundColor: '#F6F6F6' },
                  }}
                >
                  <Box sx={{ position: 'relative', flex: 1 }}>
                    <ListItemText
                      primary={userInfo}
                      secondary={`${t('chatStarted')}: ${new Date(session.createdAt).toLocaleTimeString()}`}
                      primaryTypographyProps={{
                        fontSize: '14px',
                        fontWeight: 500,
                      }}
                      secondaryTypographyProps={{
                        fontSize: '12px',
                        color: '#838383',
                      }}
                    />
                  </Box>
                  {hasUnread && (
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#ff624c',
                        flexShrink: 0,
                      }}
                    />
                  )}
                </ListItemButton>
              );
            })}
          </List>
        </AccordionDetails>
      </Accordion>

      {/* My Active Chats */}
      <Accordion defaultExpanded disableGutters elevation={0}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>
            {t('chatMyActiveChats')}
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}>
          <List disablePadding>
            {activeSessions.length === 0 && (
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
            {activeSessions.map((session) => {
              const sessionUser = session.users?.find(
                (u) => u.grade === 'FREE',
              );
              const userInfo = sessionUser
                ? `${sessionUser.name} (${sessionUser.email}${sessionUser.phoneNumber ? `, ${sessionUser.phoneNumber}` : ''})`
                : 'User';
              const lastMessage = (session as any).messages?.[0];
              const hasUnread = lastMessage?.senderRole === 'FREE';
              return (
                <ListItemButton
                  key={session.id}
                  className={chatClasses.sessionList.listItem[platform]}
                  onClick={() => handleSessionClick(session)}
                  sx={{
                    '&:hover': { backgroundColor: '#F6F6F6' },
                  }}
                >
                  <Box sx={{ position: 'relative', flex: 1 }}>
                    <ListItemText
                      primary={userInfo}
                      secondary={`${t('chatLastActive')}: ${new Date(session.updatedAt).toLocaleTimeString()}`}
                      primaryTypographyProps={{
                        fontSize: '14px',
                        fontWeight: 500,
                      }}
                      secondaryTypographyProps={{
                        fontSize: '12px',
                        color: '#838383',
                      }}
                    />
                  </Box>
                  {hasUnread && (
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#ff624c',
                        flexShrink: 0,
                      }}
                    />
                  )}
                </ListItemButton>
              );
            })}
          </List>
        </AccordionDetails>
      </Accordion>

      {/* Closed Chats (Superuser Only) */}
      {isSuperuser && (
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
              {closedSessions.map((session) => {
                const sessionUser = session.users?.find(
                  (u) => u.grade === 'FREE',
                );
                const userInfo = sessionUser
                  ? `${sessionUser.name} (${sessionUser.email}${sessionUser.phoneNumber ? `, ${sessionUser.phoneNumber}` : ''})`
                  : 'User';
                return (
                  <ListItemButton
                    key={session.id}
                    className={chatClasses.sessionList.listItem[platform]}
                    onClick={() => handleSessionClick(session)}
                    sx={{
                      '&:hover': { backgroundColor: '#F6F6F6' },
                    }}
                  >
                    <Box sx={{ position: 'relative', flex: 1 }}>
                      <ListItemText
                        primary={userInfo}
                        secondary={`${t('chatLastActive')}: ${new Date(session.updatedAt).toLocaleTimeString()}`}
                        primaryTypographyProps={{
                          fontSize: '14px',
                          fontWeight: 500,
                        }}
                        secondaryTypographyProps={{
                          fontSize: '12px',
                          color: '#838383',
                        }}
                      />
                    </Box>
                  </ListItemButton>
                );
              })}
            </List>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
};

export default ChatSessionList;
