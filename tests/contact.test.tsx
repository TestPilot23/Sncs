import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Contact, Faq } from '../src/pages/Contact';
import { FAQS } from '../src/data/content';

const fieldOf = (label: RegExp) => screen.getByLabelText(label).closest('.field');

describe('Contact form validation', () => {
  it('flags all required fields on an empty submit and does not send', async () => {
    const user = userEvent.setup();
    render(<Contact />);
    await user.click(screen.getByRole('button', { name: /send my request/i }));
    expect(fieldOf(/^name/i)).toHaveClass('bad');
    expect(fieldOf(/^email/i)).toHaveClass('bad');
    expect(fieldOf(/^service/i)).toHaveClass('bad');
    expect(fieldOf(/project details/i)).toHaveClass('bad');
    expect(screen.queryByText(/thanks — we got it/i)).not.toBeInTheDocument();
  });

  it('rejects a malformed email address', async () => {
    const user = userEvent.setup();
    render(<Contact />);
    await user.type(screen.getByLabelText(/^name/i), 'Jeff');
    await user.type(screen.getByLabelText(/^email/i), 'not-an-email');
    await user.selectOptions(screen.getByLabelText(/^service/i), 'Machine Embroidery');
    await user.type(screen.getByLabelText(/project details/i), '24 polos with our logo');
    await user.click(screen.getByRole('button', { name: /send my request/i }));
    expect(fieldOf(/^email/i)).toHaveClass('bad');
    expect(fieldOf(/^name/i)).not.toHaveClass('bad');
    expect(screen.queryByText(/thanks — we got it/i)).not.toBeInTheDocument();
  });

  it('shows the confirmation once a valid request is submitted', async () => {
    const user = userEvent.setup();
    render(<Contact />);
    await user.type(screen.getByLabelText(/^name/i), 'Jeff');
    await user.type(screen.getByLabelText(/^email/i), 'jeff@example.com');
    await user.selectOptions(screen.getByLabelText(/^service/i), 'Screen Printing');
    await user.type(screen.getByLabelText(/project details/i), 'Team hoodies for spring league');
    await user.click(screen.getByRole('button', { name: /send my request/i }));
    expect(screen.getByText(/thanks — we got it/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send my request/i })).not.toBeInTheDocument();
  });
});

describe('FAQ accordion', () => {
  it('opens the first question by default', () => {
    render(<Faq />);
    const first = screen.getByRole('button', { name: new RegExp(FAQS[0][0].slice(0, 20)) });
    expect(first).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens a clicked question and closes the previous one', async () => {
    const user = userEvent.setup();
    render(<Faq />);
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[2]);
    expect(buttons[2]).toHaveAttribute('aria-expanded', 'true');
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes an open question when clicked again', async () => {
    const user = userEvent.setup();
    render(<Faq />);
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'false');
  });
});
