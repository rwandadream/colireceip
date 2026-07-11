export function HeroAuth() {
  return (
    <div className="relative h-full overflow-hidden bg-[#08111F] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.35),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.22),_transparent_30%)]" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#09101B]/95 via-[#0B1728]/90 to-[#08111F]/95" />
      <div className="relative z-10 flex h-full flex-col justify-center px-8 py-16 sm:px-12">
        <div className="max-w-lg space-y-6">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.32em] text-slate-200 shadow-lg shadow-black/20 backdrop-blur-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB] shadow-[#2563EB]/50" />
            Sarah-Groupe
          </div>
          <div className="space-y-4">
            <h1 className="text-5xl font-semibold tracking-tight text-white">Connexion</h1>
            <p className="max-w-xl text-sm text-slate-300">Accédez à votre espace sécurisé pour gérer vos expéditions entre Bamako et Abidjan.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {['Traçabilité', 'Expédition', 'Paiement'].map((label) => (
              <div key={label} className="rounded-3xl border border-white/10 bg-white/5 p-4 text-center text-xs uppercase tracking-[0.22em] text-slate-300 shadow-sm">
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
