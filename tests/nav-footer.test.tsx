import { describe, it, expect } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';

const links = () => screen.getByRole('navigation').closest('.nav-links') as HTMLElement;

describe('Nav mobile menu', () => {
  it('is closed initially and opens from the burger', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/';
    render(<App />);
    expect(links()).not.toHaveClass('open');
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(links()).toHaveClass('open');
  });

  it('closes when the burger is pressed again', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/';
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(links()).not.toHaveClass('open');
  });

  it('closes when the scrim is clicked', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/';
    const { container } = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(container.querySelector('.nav-scrim') as HTMLElement);
    expect(links()).not.toHaveClass('open');
  });

  it('closes after navigating to another page', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/';
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(within(links()).getByRole('link', { name: 'Services' }));
    expect(links()).not.toHaveClass('open');
  });

  it('closes when the route changes outside the menu (browser back/forward)', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/';
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    act(() => {
      window.location.hash = '#/about';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(links()).not.toHaveClass('open');
  });

  it('stays closed when returning to the route the menu was last opened on', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/';
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(within(links()).getByRole('link', { name: 'Services' }));
    await user.click(within(links()).getByRole('link', { name: 'Home' }));
    expect(links()).not.toHaveClass('open');
  });

  it('can be reopened after a route change', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/';
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(within(links()).getByRole('link', { name: 'Services' }));
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(links()).toHaveClass('open');
  });
});

describe('Footer', () => {
  it('shows the current year in the copyright line', () => {
    window.location.hash = '#/';
    render(<App />);
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent(`© ${new Date().getFullYear()} Stitches-n-Color`);
  });
});
