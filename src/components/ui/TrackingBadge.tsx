import { useState } from 'react';
import { Copy, Check, Package } from 'lucide-react';
import { formatTrackingNumber } from '../../lib/format';

interface TrackingBadgeProps {
  tracking: string | null | undefined;
  showIcon?: boolean;
  copyable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function TrackingBadge({
  tracking,
  showIcon = true,
  copyable = true,
  size = 'md',
  className = '',
}: TrackingBadgeProps) {
  const [copied, setCopied] = useState(false);
  const formatted = formatTrackingNumber(tracking);

  const handleCopy = (e: React.MouseEvent) => {
    if (!copyable || !tracking) return;
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2 font-bold',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  return (
    <span
      onClick={copyable ? handleCopy : undefined}
      title={copyable ? 'Cliquer pour copier le n° de bordereau' : undefined}
      className={`inline-flex items-center font-mono font-semibold rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300 border border-brand-200/70 dark:border-brand-800/60 shadow-xs transition ${
        copyable ? 'cursor-pointer hover:bg-brand-100 dark:hover:bg-brand-900/60' : ''
      } ${sizeClasses[size]} ${className}`}
    >
      {showIcon && <Package size={iconSizes[size]} className="shrink-0 text-brand-500" />}
      <span>{formatted}</span>
      {copyable && (
        <span className="ml-0.5 text-brand-400 dark:text-brand-500">
          {copied ? <Check size={iconSizes[size] - 1} className="text-emerald-500" /> : <Copy size={iconSizes[size] - 1} />}
        </span>
      )}
    </span>
  );
}
