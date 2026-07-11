export function SarahGroupeLogo({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="100"
      height="100"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Sarah-Groupe logo"
    >
      <rect x="10" y="20" width="50" height="40" rx="10" fill="#2563EB" />
      <path d="M10 20 L35 5 L85 25 L60 40 Z" fill="#2563EB" />
      <path d="M60 40 L85 25 V65 L60 80 Z" fill="#F97316" />
      <path d="M10 20 V60 L35 75 L60 60 V20 L35 5 Z" fill="#1E3A8A" />
      <path d="M35 5 L60 20 L35 35 L10 20 Z" fill="#2563EB" opacity="0.75" />
      <path d="M60 60 L85 45 V65 L60 80 Z" fill="#F97316" opacity="0.9" />
      <path d="M20 28 H42" stroke="#2563EB" strokeWidth="5" strokeLinecap="round" />
      <path d="M94 34 H118" stroke="#F97316" strokeWidth="5" strokeLinecap="round" />
      <path d="M96 50 H112" stroke="#F97316" strokeWidth="5" strokeLinecap="round" />
      <path d="M30 38 L45 44" stroke="#2563EB" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
