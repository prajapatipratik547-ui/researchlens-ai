import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import App from '../App';

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App routing', () => {
  it('renders the landing hero', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/evidence-backed insights/i);
  });

  it('renders a 404 page for unknown routes', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
  });
});
