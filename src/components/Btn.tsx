import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { Ic } from './icons';
import { hashFor, navigate, type Route } from '../hooks/useHashRoute';

interface BtnProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to?: Route;
  href?: string;
  variant?: 'primary' | 'accent' | 'ghost' | 'white';
  icon?: boolean;
  children: ReactNode;
}

export function Btn({ to, href, variant = 'primary', children, onClick, icon, ...rest }: BtnProps) {
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    if (to) {
      e.preventDefault();
      navigate(to);
    }
    onClick?.(e);
  };
  return (
    <a
      className={`btn btn-${variant}`}
      href={href || (to ? hashFor(to) : '#')}
      onClick={go}
      {...rest}
    >
      {children}
      {icon && <Ic.arrow />}
    </a>
  );
}
