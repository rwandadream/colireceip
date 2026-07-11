import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { LogoIcon } from '../components/ui/Logo';

export function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
      <div className="text-center max-w-md animate-fade-in flex flex-col items-center">
        {/* 3D Offline Illustration with slow pulse */}
        <div className="w-48 h-48 flex items-center justify-center mb-6 animate-pulse-slow">
          <img
            src="/illustrations/offline_state_truck.png"
            alt="Mode hors ligne"
            className="w-full h-full object-contain filter drop-shadow-xl"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fb = document.getElementById('offline-fallback');
              if (fb) fb.classList.remove('hidden');
            }}
          />
          <div
            id="offline-fallback"
            className="hidden w-20 h-20 rounded-3xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 shadow-md"
          >
            <WifiOff size={40} />
          </div>
        </div>

        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-3">
          Connexion perdue
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-sm leading-relaxed">
          Vous êtes actuellement hors ligne. L'application continue de fonctionner avec vos données enregistrées en local. Vos modifications seront synchronisées automatiquement dès le retour du réseau.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
          <Button
            onClick={() => window.location.reload()}
            variant="primary"
            icon={<RefreshCw size={16} />}
            className="w-full sm:w-auto px-8"
          >
            Actualiser la page
          </Button>
        </div>

        <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-10 uppercase tracking-widest">
          <LogoIcon size={16} />
          <span>Sarah-Groupe</span>
        </div>
      </div>
    </div>
  );
}
