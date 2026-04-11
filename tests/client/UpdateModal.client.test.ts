// @vitest-environment jsdom

import UpdateModal from '@/pages/components/UpdateModal';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

describe('UpdateModal', () => {
  const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

  afterEach(() => {
    openSpy.mockRestore();
  });

  it('opens the Play Store when update is pressed on a non-iOS user agent', async () => {
    const user = userEvent.setup();
    const ua = vi
      .spyOn(navigator, 'userAgent', 'get')
      .mockReturnValue('Mozilla/5.0 Android');

    renderWithProviders(createElement(UpdateModal, { type: 'soft' }));

    await user.click(screen.getByRole('button', { name: /update/i }));

    expect(openSpy).toHaveBeenCalledWith(
      'https://play.google.com/store/apps/details?id=com.xmobile.app',
      '_blank',
    );
    ua.mockRestore();
  });

  it('invokes onDismiss for a soft update when remind later is chosen', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    renderWithProviders(
      createElement(UpdateModal, { type: 'soft', onDismiss }),
    );

    await user.click(screen.getByRole('button', { name: /remind me later/i }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
