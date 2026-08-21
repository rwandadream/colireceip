import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export function formatDate(date: string | Date | null, fmt = 'dd/MM/yyyy'): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (isNaN(d.getTime())) return '—';
  return format(d, fmt, { locale: fr });
}

export function formatDateTime(date: string | Date | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd/MM/yyyy à HH:mm', { locale: fr });
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (isNaN(d.getTime())) return '—';
  return formatDistanceToNow(d, { addSuffix: true, locale: fr });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0) + ' FCFA';
}



export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function formatTrackingNumber(tracking: string | null | undefined): string {
  if (!tracking) return '—';
  const cleanStr = tracking.trim();
  if (!cleanStr) return '—';

  // If already standard clean format: GG-COL-1001, COL-1001, or GG-1001
  if (/^(GG-COL-|COL-|GG-)\d{3,6}$/i.test(cleanStr)) {
    const num = cleanStr.match(/\d+/)?.[0] || '1001';
    return `GG-COL-${num}`;
  }

  // If timestamp or long tracking code like GG-1787308167787-1QC2D
  const digits = cleanStr.replace(/\D/g, '');
  if (digits.length >= 4) {
    const shortNum = digits.slice(-4);
    return `GG-COL-${shortNum}`;
  }

  const code = cleanStr.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
  return `GG-COL-${code || '1001'}`;
}

export function generateTrackingNumber(existing: string[] = []): string {
  const numericValues = existing
    .map((value) => {
      const match = value.match(/(\d+)/g);
      return match ? Number(match[match.length - 1]) : null;
    })
    .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0 && value < 100000);

  const nextValue = numericValues.length > 0 ? Math.max(...numericValues) + 1 : 1001;
  return `GG-COL-${String(nextValue)}`;
}

export function isToday(date: string | Date | null): boolean {
  if (!date) return false;
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

export function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function toISO(date: Date = new Date()): string {
  return date.toISOString();
}
