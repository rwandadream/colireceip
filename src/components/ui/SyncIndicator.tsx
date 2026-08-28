import { AlertTriangle, CheckCircle2, CloudOff, Loader2, RefreshCw, Send } from 'lucide-react';
import { useSync } from '../../context/SyncContext';
import type { SyncAction, SyncEntity } from '../../lib/syncTypes';

const entityLabels: Record<SyncEntity, string> = {
  clients: 'Client',
  products: 'Produit',
  parcels: 'Colis',
  payments: 'Paiement',
  trips: 'Voyage',
  'trip-vehicles': 'Véhicule',
  settings: 'Paramètres',
  expenses: 'Dépense',
};

const actionLabels: Record<SyncAction, string> = {
  create: 'créé',
  update: 'modifié',
  delete: 'supprimé',
};

export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const { state, conflicts, failed: failedMutations, syncNow, resolveConflict, resolveConflictKeepingLocal, retryFailed, dismissFailed } = useSync();

  const resolving = state.running;
  const offline = !state.online;
  const conflictsActive = state.conflictCount > 0;
  const failed = state.failedCount;
  const pending = state.pendingCount;

  let label: string;
  let icon;
  let wrapperClass: string;
  let iconClass: string;

  if (offline) {
    label = compact ? 'Hors ligne' : 'Hors ligne — reprise automatique';
    icon = <CloudOff size={14} />;
    wrapperClass = 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700';
    iconClass = 'text-slate-400 dark:text-slate-500';
  } else if (resolving) {
    label = compact ? 'Sync…' : 'Synchronisation…';
    icon = <Loader2 size={14} className="animate-spin" />;
    wrapperClass = 'text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/50 border border-brand-200 dark:border-brand-800';
    iconClass = 'text-brand-500';
  } else if (conflictsActive) {
    label = compact ? `${state.conflictCount} conflit(s)` : `${state.conflictCount} conflit(s) de synchronisation`;
    icon = <AlertTriangle size={14} />;
    wrapperClass = 'text-error-700 dark:text-error-300 bg-error-50 dark:bg-error-950/50 border border-error-200 dark:border-error-800';
    iconClass = 'text-error-500';
  } else if (failed > 0) {
    label = compact ? `${failed} en erreur` : `${failed} enregistrement(s) en erreur`;
    icon = <AlertTriangle size={14} />;
    wrapperClass = 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800';
    iconClass = 'text-amber-500';
  } else if (pending > 0) {
    label = compact ? `${pending} en attente` : `${pending} modification(s) en attente de synchro`;
    icon = <RefreshCw size={14} />;
    wrapperClass = 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800';
    iconClass = 'text-sky-500';
  } else {
    label = compact ? 'Synchro OK' : 'Tout est synchronisé';
    icon = <CheckCircle2 size={14} />;
    wrapperClass = 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800';
    iconClass = 'text-emerald-500';
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void syncNow()}
        disabled={offline || resolving}
        title="Synchroniser maintenant"
        className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium ${wrapperClass} ${!offline && !resolving ? 'hover:opacity-80 active:scale-[0.98]' : 'opacity-70'} disabled:cursor-not-allowed transition-colors`}
      >
        <span className={iconClass}>{icon}</span>
        <span className="truncate">{label}</span>
      </button>

      {!compact && conflicts.length > 0 && (
        <div className="rounded-lg border border-error-200 dark:border-error-800/60 bg-error-50/60 dark:bg-error-950/40 p-2 animate-fade-in">
          <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-error-600 dark:text-error-400 mb-1">
            Conflits à résoudre
          </div>
          <ul className="space-y-1">
            {conflicts.map((mutation) => (
              <li
                key={mutation.id}
                className="flex items-center justify-between gap-2 rounded-md bg-white dark:bg-slate-900/80 px-2 py-1.5 text-xs border border-slate-200/70 dark:border-slate-700/70"
              >
                <span className="truncate text-slate-700 dark:text-slate-300">
                  {entityLabels[mutation.entity]} · {actionLabels[mutation.action]}
                </span>
                <div className="flex flex-row-reverse items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => void resolveConflict(mutation.id)}
                    className="rounded-md bg-slate-600 hover:bg-slate-700 text-white px-2 py-0.5 text-[11px] font-medium transition-colors"
                    title="Abandonner la version locale et garder la version serveur"
                  >
                    Garder serveur
                  </button>
                  <button
                    type="button"
                    onClick={() => void resolveConflictKeepingLocal(mutation.id)}
                    className="flex items-center gap-1 rounded-md bg-error-600 hover:bg-error-700 text-white px-2 py-0.5 text-[11px] font-medium transition-colors"
                    title="Ré-appliquer la version locale après la version serveur"
                  >
                    <Send size={10} />
                    Garder local
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!compact && failedMutations.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/40 p-2 animate-fade-in">
          <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1">
            Échecs de synchronisation
          </div>
          <ul className="space-y-1">
            {failedMutations.map((mutation) => (
              <li
                key={mutation.id}
                className="flex items-center justify-between gap-2 rounded-md bg-white dark:bg-slate-900/80 px-2 py-1.5 text-xs border border-slate-200/70 dark:border-slate-700/70"
              >
                <div className="min-w-0 truncate">
                  <span className="truncate text-slate-700 dark:text-slate-300">
                    {entityLabels[mutation.entity]} · {actionLabels[mutation.action]}
                  </span>
                  {mutation.lastError && (
                    <span className="block truncate text-[10px] text-amber-600 dark:text-amber-500">{mutation.lastError}</span>
                  )}
                </div>
                <div className="flex flex-row-reverse items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => void retryFailed(mutation.id)}
                    className="rounded-md bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 text-[11px] font-medium transition-colors"
                    title="Ré-appliquer cette modification"
                  >
                    Réessayer
                  </button>
                  <button
                    type="button"
                    onClick={() => void dismissFailed(mutation.id)}
                    className="rounded-md bg-slate-600 hover:bg-slate-700 text-white px-2 py-0.5 text-[11px] font-medium transition-colors"
                    title="Abandonner cette modification et garder la version serveur"
                  >
                    Ignorer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}