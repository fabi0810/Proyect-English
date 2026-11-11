import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '../../utils/cn';

export type ButtonVariant = 'primary' | 'brand' | 'secondary' | 'ghost' | 'danger' | 'success' | 'info';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-on-ink hover:opacity-90 disabled:opacity-40',
  brand: 'bg-brand text-white hover:bg-brand-strong disabled:opacity-40 dark:text-bg',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-2 disabled:opacity-50',
  ghost: 'text-ink-soft hover:bg-surface-2 disabled:opacity-40',
  danger: 'bg-danger text-white hover:opacity-90 disabled:opacity-40 dark:text-bg',
  success: 'bg-success text-white hover:opacity-90 disabled:opacity-40 dark:text-bg',
  info: 'bg-info-soft text-info hover:brightness-95 disabled:opacity-50',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-[13px] gap-1.5 rounded-xl',
  md: 'h-11 px-5 text-sm gap-2 rounded-2xl',
  lg: 'h-13 px-6 text-[15px] gap-2 rounded-2xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, iconRight, block, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-semibold transition-all duration-150 select-none active:scale-[0.98]',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
});

export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  block,
  className,
  children,
}: {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-semibold transition-all duration-150 active:scale-[0.98]',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
    >
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-2 disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
