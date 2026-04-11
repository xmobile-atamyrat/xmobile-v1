// @vitest-environment jsdom

import ChatInput from '@/pages/components/chat/ChatInput';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

describe('ChatInput', () => {
  it('sends trimmed text when the user presses Enter without shift', async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn();

    renderWithProviders(
      createElement(ChatInput, { onSendMessage, disabled: false }),
    );

    const field = screen.getByPlaceholderText('Type a message...');
    await user.type(field, '  hi there  ');
    await user.keyboard('{Enter}');

    expect(onSendMessage).toHaveBeenCalledWith('hi there');
  });

  it('does not send whitespace-only input', async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn();

    renderWithProviders(
      createElement(ChatInput, { onSendMessage, disabled: false }),
    );

    const field = screen.getByPlaceholderText('Type a message...');
    await user.type(field, '   ');
    await user.keyboard('{Enter}');

    expect(onSendMessage).not.toHaveBeenCalled();
  });
});
