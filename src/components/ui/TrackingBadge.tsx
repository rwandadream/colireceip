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

  const doCopy = () => {
    if (!tracking) return;
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopy = (e: React.MouseEvent) => {
    if (!copyable || !tracking) return;
    e.preventDefault();
    e.stopPropagation();
    doCopy();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!copyable || !tracking) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      doCopy();
    }
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
      onKeyDown={handleKeyDown}
      role={copyable ? 'button' : undefined}
      tabIndex={copyable ? 0 : undefined}
      aria-label={copyable && tracking ? `Copier ${formatted}` : undefined}
      title={copyable ? 'Cliquer pour copier le n° de bordereau' : undefined}
      className={`inline-flex items-center font-mono font-semibold rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300 border border-brand-200/70 dark:border-brand-800/60 shadow-sm transition ${
        copyable ? 'cursor-pointer hover:bg-brand-100 dark:hover:bg-brand-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40' : ''
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
