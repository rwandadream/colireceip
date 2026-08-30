import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleButtonProps {
  className?: string;
}

export function ThemeToggleButton({ className = '' }: ThemeToggleButtonProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Activer le thème clair' : 'Activer le thème sombre'}
      title={isDark ? 'Mode clair' : 'Mode sombre'}
      className={`flex items-center justify-center w-11 h-11 mx-auto rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${className}`}
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}