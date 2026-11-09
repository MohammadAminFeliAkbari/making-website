import type { ReactNode } from 'react';

interface SectionTitleProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  children?: ReactNode;
}

export function SectionTitle({ eyebrow, title, description, align = 'left', children }: SectionTitleProps) {
  return (
    <div className={`${align === 'center' ? 'mx-auto text-center' : ''} max-w-2xl`}>
      {eyebrow && <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-primary)]">{eyebrow}</p>}
      <h2 className="font-display text-3xl font-medium leading-tight tracking-tight text-ink sm:text-4xl lg:text-5xl">{title}</h2>
      {description && <p className="mt-5 text-base leading-7 text-muted sm:text-lg">{description}</p>}
      {children}
    </div>
  );
}
