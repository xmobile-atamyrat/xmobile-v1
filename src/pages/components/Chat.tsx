import React, { useActionState, useEffect, useState } from 'react';
import {
  Box,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Input,
  Divider,
  CardMedia,
} from '@mui/material';
import { ChatBubbleOutlineOutlined, Message } from '@mui/icons-material';
import BASE_URL from '@/lib/ApiEndpoints';
import { useUserContext } from '@/pages/lib/UserContext';
import { FaPaperPlane, FaCommentDots } from 'react-icons/fa';
import { LOGO_COLOR_LIGHT } from '@/pages/lib/constants';
import { ChatSession, User } from '@prisma/client';

export interface ChatFooterProps {
  senderId: string;
  sessionId: string;
  senderRole: 'ADMIN' | 'FREE';
  content?: string;
}

export interface ChatContentProps {
  userId: string;
  senderRole: 'ADMIN' | 'FREE';
}

export interface ChatSessionProps {
  sessionId: string;
  content: [];
}

export default function ChatIcon() {
  const { user } = useUserContext();
  const [openChatDialog, setOpenChatDialog] = useState(false);
  // console.log(user.id, user.grade);

  // const openChatDialog
  const [chatSession, setChatSession] = useState<ChatSessionProps>();

  const handleOpen = async () => {
    // fetch current session, and its content
    try {
      const response = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          senderRole: user.grade,
          action: 'getChatContent',
        }),
      });

      const data = await response.json();
      setChatSession(data.data);
      setOpenChatDialog(true);

      console.log(data.data);
    } catch (error) {
      if (!user) {
        console.error('User Not Found');
      } else {
        console.error(error.error);
      }
    }
  };

  return (
    <>
      <Box className="fixed bottom-4 right-4 bg-blue-600 rounded-full shadow-lg hover:bg-blue-700">
        <IconButton onClick={handleOpen}>
          <FaCommentDots color="white"></FaCommentDots>
        </IconButton>
      </Box>

      <Box>
        <Dialog
          open={openChatDialog}
          onClose={() => {
            setOpenChatDialog(false);
          }}
          PaperProps={{
            sx: {
              position: 'fixed',
              bottom: 70,
              right: 16,
              margin: 0,
              borderRadius: 2,
              paddingLeft: 2,
              zIndex: 9999, // Ensure dialog is above other content
              height: '75%',
            },
          }}
          keepMounted
        >
          <DialogTitle className="">
            <Box
              sx={{
                width: { xs: 100, sm: 120 },
                // height: { xs: 100, sm: 120 },
                // borderBottom: 10,
                // height:
              }}
              // className="flex items-center justify-center"
            >
              <CardMedia component="img" src="/logo-recolored-cropped.jpeg" />
            </Box>
            <Divider
              sx={{
                marginTop: 1,
                borderColor: 'rgb(25, 118, 211)',
                borderWidth: 1,
              }}
            />
          </DialogTitle>

          <DialogContent>
            {/* chat content */}
            <Box>
              {/* {chatSession.content.map(Message, () => {})} */}
              {/* <ChatContent userId={user?.id} senderRole={user?.grade}/> */}
            </Box>
          </DialogContent>
          <DialogActions>
            <ChatFooter
              senderId={user?.id}
              senderRole={user?.grade}
              sessionId={chatSession?.sessionId}
            />
          </DialogActions>
        </Dialog>
      </Box>
    </>
  );
}

// function ChatContent ({userId, senderRole}: ChatContentProps) {

//   return (
//     <Box>
//       {/* {chatContent} */}
//     </Box>
//   )
// }

function ChatFooter({ senderId, sessionId, senderRole }: ChatFooterProps) {
  // if we want to add status: typing feature
  const [message, setMessage] = useState('');
  const handleMessageChange = (e: any) => {
    setMessage(e.target.value);
  };

  // const
  const handleMessageSubmit = async (e: any) => {
    e.preventDefault();

    if (message != '') {
      console.log(message);

      try {
        const response = await fetch(`${BASE_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderId,
            senderRole,
            content: message,
            isRead: false,
            action: 'sendMessage',
            sessionId,
          }),
        });
        const data = await response.json();
        console.log(data.data);

        setMessage('');
      } catch (error) {
        console.error(error.error);
      }
    }
  };

  return (
    <form onSubmit={handleMessageSubmit}>
      {/* <Box> */}
      <Input name="message" value={message} onChange={handleMessageChange} />
      <IconButton
        type="submit"
        className="ml-2 bottom-4 right-4 shadow-lg"
        onClick={() => {
          ('');
        }}
      >
        <FaPaperPlane color="rgb(25, 118, 211)" />
      </IconButton>
      {/* </Box> */}
    </form>
  );
}
