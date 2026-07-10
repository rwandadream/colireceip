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
  icon: ReactNode;
  color?: string;
  trend?: string;
}

export function StatCard({ label, value, icon, color = 'brand', trend }: StatCardProps) {
  const colorMap: Record<string, string> = {
    brand: 'from-brand-500 to-brand-600',
    accent: 'from-accent-500 to-accent-600',
    success: 'from-success-500 to-success-600',
    warning: 'from-warning-500 to-warning-600',
    error: 'from-error-500 to-error-600',
    cyan: 'from-cyan-500 to-cyan-600',
    purple: 'from-purple-500 to-purple-600',
  };

  return (
    <div className="stat-card group">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">
            {label}
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5 tabular-nums">
            {value}
          </p>
          {trend && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{trend}</p>
          )}
        </div>
        <div className={`flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${colorMap[color]} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform duration-200`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
