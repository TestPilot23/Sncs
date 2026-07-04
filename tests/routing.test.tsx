import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { parseHash, hashFor } from '../src/hooks/useHashRoute';

describe('hash helpers', () => {
  it('parses known routes and falls back to home', () => {
    window.location.hash = '#/services';
    expect(parseHash()).toBe('services');
    window.location.hash = '#/GALLERY';
    expect(parseHash()).toBe('gallery');
    window.location.hash = '#/nonsense';
    expect(parseHash()).toBe('home');
    window.location.hash = '';
    expect(parseHash()).toBe('home');
  });

  it('builds hashes with home as bare root', () => {
    expect(hashFor('home')).toBe('#/');
    expect(hashFor('contact')).toBe('#/contact');
  });
});

describe('App routing', () => {
  it('renders the home page by default', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/machine embroidery/i);
    expect(document.title).toContain('Custom Embroidery in St. Louis');
  });

  it('renders the page matching the current hash', () => {
    window.location.hash = '#/about';
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /a little st\. louis studio/i,
    );
    expect(document.title).toContain('About Us');
  });

  it('navigates when a nav link is clicked and marks it active', async () => {
    const user = userEvent.setup();
    render(<App />);
    const nav = within(screen.getByRole('navigation'));
    await user.click(nav.getByRole('link', { name: 'Services' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        /custom apparel, done four ways/i,
      ),
    );
    expect(nav.getByRole('link', { name: 'Services' })).toHaveClass('active');
    expect(nav.getByRole('link', { name: 'Home' })).not.toHaveClass('active');
    expect(document.title).toContain('Services');
  });

  it('falls back to home for unknown hashes', () => {
    window.location.hash = '#/bogus';
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/machine embroidery/i);
  });
});
