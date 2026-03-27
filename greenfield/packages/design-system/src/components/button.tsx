import { clsx } from 'clsx';

import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

export interface ButtonProps
  extends PropsWithChildren,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  className?: string;
  size?: 'lg' | 'md' | 'sm';
  tone?: 'ghost' | 'primary' | 'secondary' | 'subtle';
}

export function Button({
  children,
  className,
  size = 'md',
  tone = 'primary',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx('mc-button', `mc-button--${tone}`, `mc-button--${size}`, className)}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
