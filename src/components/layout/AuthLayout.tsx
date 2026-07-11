import { ReactNode } from 'react';
import { motion } from 'framer-motion';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#08111F] text-white overflow-hidden">
      {/* Background avec dégradé et effet glassmorphism */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.35),_transparent_25%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.22),_transparent_30%)]" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#09101B]/90 via-[#0B1728]/85 to-[#08111F]/95" />
        
        {/* Illustration SVG abstraite - Camion de livraison stylisé */}
        <svg
          viewBox="0 0 1200 800"
          className="absolute inset-0 w-full h-full object-cover opacity-10"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="truckGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#2563EB', stopOpacity: 0.6 }} />
              <stop offset="100%" style={{ stopColor: '#F97316', stopOpacity: 0.4 }} />
            </linearGradient>
          </defs>
          
          {/* Camion stylisé */}
          <rect x="150" y="350" width="200" height="150" rx="20" fill="url(#truckGradient)" />
          <circle cx="220" cy="520" r="35" fill="#2563EB" opacity="0.7" />
          <circle cx="330" cy="520" r="35" fill="#2563EB" opacity="0.7" />
          <rect x="380" y="280" width="300" height="200" rx="15" fill="#F97316" opacity="0.4" />
          <circle cx="480" cy="500" r="40" fill="#2563EB" opacity="0.5" />
          
          {/* Colis empilés */}
          <rect x="750" y="250" width="80" height="80" fill="#F97316" opacity="0.5" />
          <rect x="760" y="320" width="80" height="80" fill="#2563EB" opacity="0.4" />
          <rect x="770" y="390" width="80" height="80" fill="#F97316" opacity="0.35" />
          
          {/* Lignes de vitesse */}
          <line x1="100" y1="400" x2="30" y2="400" stroke="#2563EB" strokeWidth="3" opacity="0.6" />
          <line x1="110" y1="450" x2="20" y2="450" stroke="#2563EB" strokeWidth="2" opacity="0.4" />
          <line x1="115" y1="500" x2="25" y2="500" stroke="#2563EB" strokeWidth="2" opacity="0.3" />
          
          {/* Points d'emphase */}
          <circle cx="950" cy="200" r="60" fill="#2563EB" opacity="0.15" />
          <circle cx="150" cy="650" r="80" fill="#F97316" opacity="0.1" />
        </svg>
      </div>

      {/* Contenu principal centré */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          <div className="rounded-[32px] bg-white/95 backdrop-blur-xl shadow-[0_45px_120px_-55px_rgba(15,23,42,0.5)] border border-slate-200/50 p-6 sm:p-8">
            {children}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
