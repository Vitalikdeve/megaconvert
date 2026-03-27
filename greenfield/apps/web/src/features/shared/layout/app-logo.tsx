export function AppLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(145deg,var(--mc-color-accent),var(--mc-color-highlight))] text-sm font-black text-white shadow-[0_20px_45px_rgba(49,95,255,0.24)]">
        <span className="absolute inset-[1px] rounded-[1.25rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.34),transparent_56%)]" />
        <span className="relative">MC</span>
      </div>
      <div className="grid">
        <span className="font-[family-name:var(--font-display)] text-[0.82rem] font-bold uppercase tracking-[0.22em] text-ink-subtle">
          Megaconvert
        </span>
        <span className="text-sm font-semibold tracking-[-0.03em] text-ink">
          Messenger Control Surface
        </span>
      </div>
    </div>
  );
}
