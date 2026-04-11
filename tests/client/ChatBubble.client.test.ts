// @vitest-environment jsdom

import ChatBubble from '@/pages/components/chat/ChatBubble';
import type { ChatMessage } from '@/pages/lib/types';
import { screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

describe('ChatBubble', () => {
  it('renders message text for the other party', () => {
    const message: ChatMessage = {
      type: 'message',
      sessionId: 's1',
      senderId: 'staff-1',
      senderRole: 'ADMIN',
      content: 'Your order is ready',
      timestamp: '2024-06-01T12:00:00.000Z',
    };

    renderWithProviders(createElement(ChatBubble, { message, isMe: false }));

    expect(screen.getByText('Your order is ready')).toBeInTheDocument();
  });

  it('shows an error marker for failed outbound messages', () => {
    const message: ChatMessage = {
      type: 'message',
      sessionId: 's1',
      senderId: 'u1',
      senderRole: 'FREE',
      content: 'Ping',
      status: 'error',
      timestamp: '2024-06-01T12:00:00.000Z',
    };

    renderWithProviders(createElement(ChatBubble, { message, isMe: true }));

    expect(screen.getByText('!')).toBeInTheDocument();
  });
});
