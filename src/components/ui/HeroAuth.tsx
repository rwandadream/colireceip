import { motion } from 'framer-motion';
import { Truck, MapPin, Package, Navigation } from 'lucide-react';

export function HeroAuth() {
  return (
    <div className="text-white">
      <div className="mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-white/10 p-3 mb-4">
          <Truck size={28} />
        </div>
        <h2 className="text-3xl font-bold leading-tight">Envoyez vos colis simplement</h2>
        <p className="mt-3 text-white/90">Suivez vos livraisons en temps réel — préparation, transport et livraison, tout en un seul endroit.</p>
      </div>

      <motion.div className="mt-8 grid grid-cols-2 gap-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="bg-white/10 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-3 bg-white/20 rounded-lg"><MapPin size={20} /></div>
          <div>
            <div className="text-sm font-semibold">Traçabilité</div>
            <div className="text-xs text-white/80">Suivi en temps réel</div>
          </div>
        </div>
        <div className="bg-white/10 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-3 bg-white/20 rounded-lg"><Package size={20} /></div>
          <div>
            <div className="text-sm font-semibold">Gestion</div>
            <div className="text-xs text-white/80">Expéditions & facturation</div>
          </div>
        </div>
        <div className="bg-white/10 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-3 bg-white/20 rounded-lg"><Navigation size={20} /></div>
          <div>
            <div className="text-sm font-semibold">Routage</div>
            <div className="text-xs text-white/80">Itinéraires optimisés</div>
          </div>
        </div>
        <div className="bg-white/10 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-3 bg-white/20 rounded-lg"><Truck size={20} /></div>
          <div>
            <div className="text-sm font-semibold">Livraisons</div>
            <div className="text-xs text-white/80">Confirmations rapides</div>
          </div>
        </div>
      </motion.div>

      <div className="mt-8">
        <div className="rounded-xl overflow-hidden">
          {/* Placeholder illustration area - replace with high-quality image matching brand */}
          <div className="w-full h-56 bg-gradient-to-r from-white/6 to-white/3 rounded-xl flex items-center justify-center">
            <svg width="260" height="120" viewBox="0 0 260 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-90">
              <rect x="0" y="0" width="260" height="120" rx="12" fill="white" opacity="0.05" />
              <g stroke="white" strokeOpacity="0.85" strokeWidth="1.5" strokeLinecap="round">
                <path d="M20 90 L80 50 L140 75 L200 45 L240 60" />
                <circle cx="20" cy="90" r="3" fill="white" />
                <circle cx="240" cy="60" r="3" fill="white" />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
