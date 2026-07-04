import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Gallery } from '../src/pages/Gallery';
import { GAL } from '../src/data/content';

const caps = () =>
  screen.getAllByText(/./, { selector: '.gal-item .cap' }).map((el) => el.textContent);

describe('Gallery filtering', () => {
  it('shows every item under "All work" by default', () => {
    render(<Gallery />);
    expect(screen.getByRole('button', { name: 'All work' })).toHaveClass('active');
    expect(caps()).toHaveLength(GAL.length);
  });

  it('shows only screen-printing items when that chip is selected', async () => {
    const user = userEvent.setup();
    render(<Gallery />);
    await user.click(screen.getByRole('button', { name: 'Screen Printing' }));
    const expected = GAL.filter((g) => g[2] === 'screen').map((g) => g[0]);
    expect(caps()).toEqual(expected);
    expect(screen.getByRole('button', { name: 'Screen Printing' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'All work' })).not.toHaveClass('active');
  });

  it('returns to the full set when switching back to All work', async () => {
    const user = userEvent.setup();
    render(<Gallery />);
    await user.click(screen.getByRole('button', { name: 'Digitizing' }));
    expect(caps()).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'All work' }));
    expect(caps()).toHaveLength(GAL.length);
  });
});
