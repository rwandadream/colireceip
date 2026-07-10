import { motion } from 'framer-motion';

export function HeroDashboard() {
  return (
    <motion.div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-brand-600 to-brand-500 text-white p-6 lg:p-8 shadow-lg" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
        <div className="flex-1">
          <h2 className="text-2xl lg:text-3xl font-bold">Suivi des livraisons en temps réel</h2>
          <p className="mt-2 text-sm text-white/90 max-w-xl">Visualisez vos opérations, suivez vos coursiers et optimisez vos itinéraires depuis un seul tableau de bord.</p>

          <div className="mt-4 flex items-center gap-3">
            <span className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-medium">Live&nbsp;<span className="inline-block w-2 h-2 rounded-full bg-accent-500 animate-pulse"/></span>
            <span className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs">Colis en transit: <strong className="ml-1">{/* dynamic count placeholder */} {" "}</strong></span>
          </div>

          <div className="mt-6 hidden lg:flex gap-3">
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-xs text-white/80">Taux de livraison</div>
              <div className="text-lg font-semibold">{Math.round(92)}%</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-xs text-white/80">Temps moyen</div>
              <div className="text-lg font-semibold">2h 14m</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-xs text-white/80">Satisfaction</div>
              <div className="text-lg font-semibold">4.8 ★</div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-1/2">
          {/* SVG illustration representing a delivery vehicle and route - integrated into UI */}
          <div className="w-full h-48 lg:h-40 bg-white/5 rounded-xl flex items-center justify-center">
            <svg viewBox="0 0 560 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
              <defs>
                <linearGradient id="g1" x1="0" x2="1">
                  <stop offset="0" stopColor="#ffffff" stopOpacity="0.08" />
                  <stop offset="1" stopColor="#ffffff" stopOpacity="0.04" />
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="100%" height="100%" fill="url(#g1)" />
              <g transform="translate(40,40)">
                <path d="M0 120 C80 80 160 160 240 120 C320 80 400 160 480 120" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="0" cy="120" r="6" fill="#fff" />
                <circle cx="240" cy="120" r="8" fill="#F97316" />
                <circle cx="480" cy="120" r="6" fill="#fff" />
                <g transform="translate(220,80)">
                  <rect x="0" y="10" width="70" height="30" rx="6" fill="#fff" opacity="0.95" />
                  <rect x="6" y="16" width="58" height="18" rx="4" fill="#e6eefb" />
                  <rect x="-12" y="28" width="96" height="6" rx="3" fill="#1E3A8A" />
                </g>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
