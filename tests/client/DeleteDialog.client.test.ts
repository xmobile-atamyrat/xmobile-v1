// @vitest-environment jsdom

import DeleteDialog from '@/pages/components/DeleteDialog';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

describe('DeleteDialog', () => {
  it('calls handleClose when cancel is pressed', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleDelete = vi.fn();

    renderWithProviders(
      createElement(DeleteDialog, {
        title: 'Remove item?',
        handleClose,
        handleDelete,
      }),
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(handleDelete).not.toHaveBeenCalled();
  });

  it('runs handleDelete when delete is confirmed', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleDelete = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
      createElement(DeleteDialog, {
        title: 'Remove item?',
        handleClose,
        handleDelete,
      }),
    );

    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(handleDelete).toHaveBeenCalledTimes(1);
  });
});
