// @vitest-environment jsdom

import NameDialog from '@/pages/procurement/components/NameDialog';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../helpers/renderWithProviders';

describe('NameDialog', () => {
  it('blocks an empty name and shows the inline error', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      createElement(NameDialog, {
        title: 'New order',
        onClose: vi.fn(),
        onSubmit,
      }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Required fields are empty.')).toBeTruthy();
  });

  it('submits the trimmed value on Enter and closes', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderWithProviders(
      createElement(NameDialog, {
        title: 'Rename',
        initialValue: 'Old',
        onClose,
        onSubmit,
      }),
    );

    const input = screen.getByRole('textbox', { name: 'Rename' });
    await userEvent.clear(input);
    await userEvent.type(input, '  Week 45  {Enter}');

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith('Week 45');
  });

  it('stays open when saving throws', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('network'));
    const onClose = vi.fn();
    renderWithProviders(
      createElement(NameDialog, {
        title: 'Rename',
        initialValue: 'Order',
        onClose,
        onSubmit,
      }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });
});
