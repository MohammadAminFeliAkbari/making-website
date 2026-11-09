import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type ButtonVariant = 'primary' | 'secondary' | 'outline';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  href?: string;
  to?: string;
  className?: string;
  onClick?: () => void;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--color-primary)] text-white shadow-sm hover:bg-[var(--color-primary-dark)]',
  secondary: 'bg-white text-ink shadow-sm ring-1 ring-black/5 hover:bg-sand',
  outline: 'border border-line bg-transparent text-ink hover:border-ink/30 hover:bg-white',
};

export function Button({
  children,
  variant = 'primary',
  href,
  to,
  className = '',
  onClick,
  ...props
}: ButtonProps) {
  const classes = `inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${variantClasses[variant]} ${className}`;

  if (to) return <Link className={classes} to={to} onClick={onClick}>{children}</Link>;
  if (href) return <a className={classes} href={href} onClick={onClick}>{children}</a>;
  return <button className={classes} onClick={onClick} {...props}>{children}</button>;
}
