// @vitest-environment jsdom

import enMessages from '@/i18n/en.json';
import ChatWelcomeBanner from '@/pages/components/chat/ChatWelcomeBanner';
import { screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

describe('ChatWelcomeBanner', () => {
  it('renders the support title and welcome message', () => {
    renderWithProviders(createElement(ChatWelcomeBanner));

    expect(
      screen.getByText(enMessages.chatCustomerSupport),
    ).toBeInTheDocument();
    expect(screen.getByText(enMessages.chatWelcomeMessage)).toBeInTheDocument();
  });
});
