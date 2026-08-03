import type { SVGProps } from 'react';

interface LogoProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export function LogoIcon({ size = 40, className, ...props }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        {/* Gradients for 3D Isometric Cube */}
        <linearGradient id="logo-top-grad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
        <linearGradient id="logo-right-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
        <linearGradient id="logo-left-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>

        {/* Speed Lines Gradient Fading In */}
        <linearGradient id="logo-speed-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#F97316" stopOpacity="0.1" />
          <stop offset="50%" stopColor="#F97316" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#F97316" stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Speed Lines */}
      <path
        d="M 8,37 L 33,37"
        stroke="url(#logo-speed-grad)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M 4,47 L 41,47"
        stroke="url(#logo-speed-grad)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M 10,57 L 36,57"
        stroke="url(#logo-speed-grad)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M 16,67 L 31,67"
        stroke="url(#logo-speed-grad)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* 3D Isometric Cube */}
      {/* Top Face */}
      <polygon points="60,22 85,33 60,45 35,33" fill="url(#logo-top-grad)" />
      {/* Right Face */}
      <polygon points="60,45 85,33 85,66 60,78" fill="url(#logo-right-grad)" />
      {/* Left Face */}
      <polygon points="35,33 60,45 60,78 35,66" fill="url(#logo-left-grad)" />
    </svg>
  );
}

interface LogoBrandProps {
  size?: number;
  showSubtitle?: boolean;
  subtitle?: string;
  className?: string;
}

export function LogoBrand({
  size = 40,
  showSubtitle = true,
  subtitle = 'Livraison rapide et sécurisée',
  className = '',
}: LogoBrandProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LogoIcon size={size} className="flex-shrink-0" />
      <div className="min-w-0 flex flex-col justify-center text-left">
        <div className="flex items-baseline font-extrabold tracking-wide text-lg sm:text-xl">
          <span className="text-slate-900 dark:text-white">Groupe</span>
          <span className="text-[#2563EB] ml-0.5">-Gaff</span>
        </div>
        {showSubtitle && (
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold tracking-wide mt-0.5">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
