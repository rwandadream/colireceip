import { motion } from 'framer-motion';

export function MapCard() {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-900">Carte: Suivi en temps réel</h3>
          <p className="text-xs text-slate-500">Positions des livreurs et itinéraires actifs</p>
        </div>
        <div className="text-xs text-slate-400">Mise à jour: maintenant</div>
      </div>

      <div className="w-full h-64 bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden relative">
        {/* Simple illustrative map with route and moving vehicle dot */}
        <svg viewBox="0 0 800 400" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="mapg" x1="0" x2="1">
              <stop offset="0" stopColor="#eaf2ff" />
              <stop offset="1" stopColor="#ffffff" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#mapg)" />
          <g stroke="#2563EB" strokeWidth="3" fill="none" strokeLinecap="round">
            <path id="route" d="M40 300 C180 200 300 320 420 240 C540 160 660 280 760 220" />
          </g>
          <circle cx="40" cy="300" r="8" fill="#1E3A8A" />
          <circle r="8" fill="#F97316">
            <animateMotion dur="8s" repeatCount="indefinite" path="M40 300 C180 200 300 320 420 240 C540 160 660 280 760 220" />
          </circle>
          <g transform="translate(680,60)">
            <rect x="0" y="0" width="110" height="36" rx="8" fill="#ffffff" opacity="0.9" />
            <text x="12" y="22" fontSize="12" fill="#1E293B">Livreur #42 · 7min</text>
          </g>
        </svg>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-accent-500" />
          En cours
        </div>
        <div className="flex items-center gap-4">
          <div>Vitesse moyenne: <strong className="ml-1">48 km/h</strong></div>
          <div>Dernière position: <strong className="ml-1">5 min</strong></div>
        </div>
      </div>
    </motion.div>
  );
}
