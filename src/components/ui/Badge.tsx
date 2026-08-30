import { type ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  className?: string;
}

export function Badge({ children, className = '' }: BadgeProps) {
  return <span className={`badge ${className}`}>{children}</span>;
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 sm:py-12 px-4 text-center animate-fade-in">
      <div className="w-32 h-32 flex items-center justify-center mb-4 animate-float">
        <img
          src="/illustrations/empty_state_package.png"
          alt="Aucun élément"
          className="w-full h-full object-contain filter drop-shadow-lg"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const parent = e.currentTarget.parentElement;
            if (parent) {
              const fb = parent.querySelector('.fallback-icon');
              if (fb) fb.classList.remove('hidden');
            }
          }}
        />
        <div className="fallback-icon hidden w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500">
          {icon}
        </div>
      </div>
      <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1.5">{title}</h2>
      {description && (
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">{description}</p>
      )}
      {action}
    </div>
  );
}

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 24, className = '' }: SpinnerProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg
        className="animate-spin text-brand-500"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}
