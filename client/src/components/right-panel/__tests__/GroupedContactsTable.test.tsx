/* @vitest-environment happy-dom */
// FILE: client/src/components/right-panel/__tests__/GroupedContactsTable.test.tsx
// PURPOSE: Render tests for GroupedContactsTable — collapsible per-customer sections
// USED BY: vitest

import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { GroupedContactsTable } from '../GroupedContactsTable';

const contacts = [
  { fullName: 'Jane Smith', position: 'AP', phone: '555-0001', email: 'j@acme.com', customerName: 'Acme' },
  { fullName: 'John Doe', position: 'Buyer', phone: '555-0002', email: 'j2@acme.com', customerName: 'Acme' },
  { fullName: 'Bob Lee', position: 'AP', phone: '555-0003', email: 'b@beta.com', customerName: 'Beta' },
];

function renderIntoContainer(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(ui); });
  return {
    container,
    unmount: () => act(() => { root.unmount(); document.body.removeChild(container); }),
  };
}

describe('GroupedContactsTable', () => {
  it('renders one section per customer', () => {
    const { container, unmount } = renderIntoContainer(<GroupedContactsTable contacts={contacts} />);
    expect(container.textContent).toContain('Acme');
    expect(container.textContent).toContain('Beta');
    unmount();
  });

  it('starts collapsed — contact rows are not visible initially', () => {
    const { container, unmount } = renderIntoContainer(<GroupedContactsTable contacts={contacts} />);
    // email addresses should not be visible when collapsed
    expect(container.textContent).not.toContain('j@acme.com');
    unmount();
  });

  it('expands a section on header click', () => {
    const { container, unmount } = renderIntoContainer(<GroupedContactsTable contacts={contacts} />);
    const buttons = container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]');
    const acmeButton = Array.from(buttons).find(b => b.textContent?.includes('Acme'));
    expect(acmeButton).toBeTruthy();
    act(() => { acmeButton!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(container.textContent).toContain('j@acme.com');
    expect(container.textContent).toContain('j2@acme.com');
    unmount();
  });

  it('reports contact count in each section header', () => {
    const { container, unmount } = renderIntoContainer(<GroupedContactsTable contacts={contacts} />);
    expect(container.textContent).toContain('2 contacts');
    expect(container.textContent).toContain('1 contact');
    unmount();
  });
});
