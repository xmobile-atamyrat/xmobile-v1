// @vitest-environment jsdom

import CatalogSheet from '@/pages/procurement/components/CatalogSheet';
import type {
  CatalogItem,
  ProcurementContextValue,
} from '@/pages/procurement/lib/ProcurementContext';
import type { ProductsSuppliersType } from '@/pages/procurement/lib/types';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../helpers/renderWithProviders';

// The sheet only talks to useProcurement(); a tiny stateful fake stands in for
// the provider so adds/creates/edits show up the way they do on the page.
let current: Partial<ProcurementContextValue> = {};
vi.mock('@/pages/procurement/lib/ProcurementContext', () => ({
  useProcurement: () => current,
}));

const mk = (id: string, name: string, description?: string | null) =>
  ({
    id,
    name,
    ...(description !== undefined ? { description } : {}),
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as CatalogItem;

const base = [
  mk('p1', 'iPhone 15 Pro Max 256GB Natural Titanium'),
  mk('p2', 'Pixel 9'),
  mk('p3', 'Pixel 9 Pro'),
];
const suppliers = [mk('s1', 'Mobile World', 'Tel. 111')];

const spies = {
  searchCatalog: vi.fn(),
  addCatalogItemToOrder: vi.fn(),
  createCatalogItem: vi.fn(),
  editCatalogItem: vi.fn(),
  deleteCatalogItem: vi.fn(),
  closeCatalog: vi.fn(),
};

function Harness({
  type,
  items,
  inOrder = [],
}: {
  type: ProductsSuppliersType;
  items: CatalogItem[];
  inOrder?: CatalogItem[];
}) {
  const [searched, setSearched] = useState<CatalogItem[]>([]);
  const [selected, setSelected] = useState<CatalogItem[]>(inOrder);

  current = {
    catalogType: type,
    selectedHistory: { name: 'Week 45' } as never,
    searchedItems: searched,
    selectedProducts: (type === 'product' ? selected : []) as never,
    selectedSuppliers: (type === 'supplier' ? selected : []) as never,
    closeCatalog: spies.closeCatalog,
    searchCatalog: (keyword: string) => {
      spies.searchCatalog(keyword);
      setSearched(
        items.filter((i) =>
          i.name.toLowerCase().includes(keyword.toLowerCase()),
        ),
      );
    },
    addCatalogItemToOrder: async (item: CatalogItem) => {
      spies.addCatalogItemToOrder(item);
      setSelected((prev) => [item, ...prev]);
    },
    createCatalogItem: async (name: string) => {
      spies.createCatalogItem(name);
      const created = mk('new', name);
      setSearched([created]);
      return created;
    },
    editCatalogItem: async (edit) => {
      spies.editCatalogItem(edit);
      setSearched((list) =>
        list.map((i) => (i.id === edit.id ? { ...i, ...edit } : i)),
      );
    },
    deleteCatalogItem: async (id: string) => {
      spies.deleteCatalogItem(id);
      setSearched((list) => list.filter((i) => i.id !== id));
    },
  };
  return createElement(CatalogSheet);
}

const render = (props: Parameters<typeof Harness>[0]) =>
  renderWithProviders(createElement(Harness, props));

const searchBox = (name = 'Search products') =>
  screen.getByRole('textbox', { name });

describe('CatalogSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing while no catalog is open', () => {
    current = { catalogType: undefined };
    const { container } = renderWithProviders(createElement(CatalogSheet));
    expect(container.innerHTML).toBe('');
  });

  it('shows a hint first, then searches as you type', async () => {
    render({ type: 'product', items: base });

    expect(screen.getByText('Add Products')).toBeTruthy();
    expect(
      screen.getByText(
        'Type a product name to find it in the base or create a new one',
      ),
    ).toBeTruthy();
    expect(document.activeElement).toBe(searchBox());

    await userEvent.type(searchBox(), 'pix');

    expect(spies.searchCatalog).toHaveBeenLastCalledWith('pix');
    expect(await screen.findByText('Pixel 9 Pro')).toBeTruthy();
    expect(screen.queryByText('iPhone 15 Pro Max 256GB Natural Titanium')).toBe(
      null,
    );

    // Clearing returns to the hint and never asks for the whole base.
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(spies.searchCatalog).not.toHaveBeenCalledWith('');
    expect(screen.queryByText('Pixel 9 Pro')).toBe(null);
  });

  it('adds an item, flips it to "In order" and counts it in the footer', async () => {
    render({ type: 'product', items: base, inOrder: [base[2]] });
    await userEvent.type(searchBox(), 'pixel');

    const proRow = (await screen.findByText('Pixel 9 Pro')).closest(
      'li',
    ) as HTMLElement;
    expect(within(proRow).getByText('In order')).toBeTruthy();

    await userEvent.click(
      screen.getByRole('button', { name: 'Add to order: Pixel 9' }),
    );

    expect(spies.addCatalogItemToOrder).toHaveBeenCalledWith(base[1]);
    const row = screen.getByText('Pixel 9').closest('li') as HTMLElement;
    await waitFor(() => expect(within(row).getByText('In order')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Done (1 added)' })).toBeTruthy();

    await userEvent.click(
      screen.getByRole('button', { name: 'Done (1 added)' }),
    );
    expect(spies.closeCatalog).toHaveBeenCalled();
  });

  it('offers create-and-add only when no exact (case-insensitive) match', async () => {
    render({ type: 'product', items: base });

    await userEvent.type(searchBox(), 'pixel 9');
    await screen.findByText('Pixel 9 Pro');
    expect(screen.queryByRole('button', { name: /^Create “/ })).toBe(null);

    await userEvent.clear(searchBox());
    await userEvent.type(searchBox(), 'Galaxy S24 ');
    expect(screen.getByText('Nothing found in the base')).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', { name: /Create “Galaxy S24” and add/ }),
    );

    expect(spies.createCatalogItem).toHaveBeenCalledWith('Galaxy S24');
    await waitFor(() =>
      expect(spies.addCatalogItemToOrder).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'new', name: 'Galaxy S24' }),
      ),
    );
    const row = screen.getByText('Galaxy S24').closest('li') as HTMLElement;
    await waitFor(() => expect(within(row).getByText('In order')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /^Create “/ })).toBe(null);
  });

  it('renames a product from the ⋯ menu', async () => {
    render({ type: 'product', items: base });
    await userEvent.type(searchBox(), 'pixel');
    await screen.findByText('Pixel 9 Pro');

    await userEvent.click(
      screen.getByRole('button', { name: 'Actions: Pixel 9 Pro' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

    const field = screen.getByRole('textbox', { name: 'Rename' });
    expect((field as HTMLInputElement).value).toBe('Pixel 9 Pro');
    await userEvent.clear(field);
    await userEvent.type(field, 'Pixel 9 Pro XL');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(spies.editCatalogItem).toHaveBeenCalledWith({
      id: 'p3',
      name: 'Pixel 9 Pro XL',
    });
    expect(await screen.findByText('Pixel 9 Pro XL')).toBeTruthy();
  });

  it('edits a supplier name and note together', async () => {
    render({ type: 'supplier', items: suppliers });
    await userEvent.type(searchBox('Search suppliers'), 'mobile');
    expect(await screen.findByText('Tel. 111')).toBeTruthy();

    await userEvent.click(
      screen.getByRole('button', { name: 'Actions: Mobile World' }),
    );
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Edit supplier' }),
    );
    const note = screen.getByRole('textbox', { name: 'Note' });
    await userEvent.clear(note);
    await userEvent.type(note, 'Tel. 222');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(spies.editCatalogItem).toHaveBeenCalledWith({
      id: 's1',
      name: 'Mobile World',
      description: 'Tel. 222',
    });
  });

  it('asks before deleting from the base, with the "all orders" warning', async () => {
    render({ type: 'product', items: base });
    await userEvent.type(searchBox(), 'pixel');
    await screen.findByText('Pixel 9 Pro');

    await userEvent.click(
      screen.getByRole('button', { name: 'Actions: Pixel 9' }),
    );
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Delete from base' }),
    );

    const dialog = screen
      .getByText(/removed from all previous orders/)
      .closest('[role="dialog"]') as HTMLElement;
    expect(spies.deleteCatalogItem).not.toHaveBeenCalled();
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' }),
    );

    expect(spies.deleteCatalogItem).toHaveBeenCalledWith('p2');
    await waitFor(() =>
      expect(screen.queryByText('Pixel 9', { exact: true })).toBe(null),
    );
  });
});
