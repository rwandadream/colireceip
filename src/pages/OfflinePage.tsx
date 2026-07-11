import { WifiOff, Truck } from 'lucide-react';
import { SarahGroupeLogo } from '../components/ui/SarahGroupeLogo';

export function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="text-center max-w-md rounded-[32px] border border-slate-200/70 bg-white p-8 shadow-[0_35px_90px_-50px_rgba(15,23,42,0.18)] dark:border-slate-700/70 dark:bg-slate-950">
        <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-[#2563EB]/10 text-[#2563EB] shadow-[0_18px_40px_-18px_rgba(37,99,235,0.5)]">
          <SarahGroupeLogo className="h-8 w-8" />
        </div>
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 mb-6">
          <WifiOff size={40} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Hors connexion</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Vous êtes actuellement hors ligne. L'application continue de fonctionner
          avec les données enregistrées localement. Vos modifications seront
          synchronisées dès que la connexion reviendra.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-slate-400 dark:text-slate-500 mb-6">
          <Truck size={16} />
          Sarah-Groupe
        </div>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary mt-2"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
