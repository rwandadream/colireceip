import { WifiOff, Truck } from 'lucide-react';

export function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 mb-6">
          <WifiOff size={40} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Hors connexion</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Vous êtes actuellement hors ligne. L'application continue de fonctionner
          avec les données enregistrées localement. Vos modifications seront
          synchronisées dès que la connexion reviendra.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-slate-400 dark:text-slate-500">
          <Truck size={16} />
          Transit Mali CI
        </div>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary mt-6"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
