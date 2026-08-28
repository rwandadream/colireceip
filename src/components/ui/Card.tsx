import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = '', hover = false, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`card ${hover ? 'card-hover cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: string;
  trend?: string;
  className?: string;
}

const STAT_COLORS: Record<string, string> = {
  brand: 'text-brand-500 dark:text-brand-400',
  success: 'text-emerald-500 dark:text-emerald-400',
  warning: 'text-amber-500 dark:text-amber-400',
  accent: 'text-accent-500 dark:text-accent-400',
  purple: 'text-purple-500 dark:text-purple-400',
  cyan: 'text-cyan-500 dark:text-cyan-400',
};

export function StatCard({ label, value, icon, color, trend, className = '' }: StatCardProps) {
  const iconColor = color ? STAT_COLORS[color] || STAT_COLORS.brand : 'text-slate-400 dark:text-slate-500';
  return (
    <div className={`card p-4 flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
          {label}
        </p>
        {icon && (
          <span className={`flex-shrink-0 ${iconColor}`}>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
          {value}
        </p>
        {trend && (
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">{trend}</span>
        )}
      </div>
    </div>
  );
}
