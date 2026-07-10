import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { HeroAuth } from '../ui/HeroAuth';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[color:var(--bg-primary)] flex items-stretch">
      {/* Left: hero (hidden on small screens) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-7/12 items-center justify-center bg-gradient-to-b from-brand-500 to-brand-600 text-white p-12">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} className="max-w-lg w-full">
          <HeroAuth />
        </motion.div>
      </div>

      {/* Right: form area */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-md">
          {children}
        </motion.div>
      </div>
    </div>
  );
}
