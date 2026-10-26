/** Rentora mark: a rounded tile with a stylised building and open doorway. Pure SVG, scales down to 16px. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Rentora" className={className}>
      <rect width="32" height="32" rx="8" fill="#2563EB" />
      <path d="M9 24V12.5L16 7l7 5.5V24" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M13.5 24v-5.5a2.5 2.5 0 0 1 5 0V24" fill="#fff" fillOpacity=".95" />
    </svg>
  )
}

export function Logo({ size = 32, light, suffix }: { size?: number; light?: boolean; suffix?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      <span className={`text-lg font-semibold tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>
        Rentora{suffix && <span className="ml-1.5 rounded-md bg-purple-100 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-purple-800">{suffix}</span>}
      </span>
    </span>
  )
}
