import { CloudOff } from 'lucide-react';
import { useSync } from '../../context/SyncContext';

export function OfflineNotice() {
  const { state } = useSync();
  if (state.online) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/40 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
      <CloudOff size={15} className="mt-0.5 flex-shrink-0 text-amber-500" />
      <span className="leading-relaxed">
        Hors ligne : cette page ne travaille que sur les données locales de cet
        appareil. Vos modifications resteront sur cet appareil et ne pourront
        être partagées que lorsque la connexion sera rétablie.
      </span>
    </div>
  );
}