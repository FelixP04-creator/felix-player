// Eigene, konsequente 24-px-Icon-Sprache: 1.6-stroke, runde Enden,
// Füllformen nur für Wiedergabe-Zustände. (Keine Emoji, keine Mix-and-Match-Kit.)

type P = { size?: number; className?: string };
const S = (size = 22) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconHome = ({ size, className }: P) => (
  <svg {...S(size)} className={className}>
    <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />
  </svg>
);

export const IconSearch = ({ size, className }: P) => (
  <svg {...S(size)} className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);

export const IconLibrary = ({ size, className }: P) => (
  <svg {...S(size)} className={className}>
    <path d="M5 4v16M9.5 4v16" />
    <path d="m14 5 6 15-2.5 1L11.5 6.5z" />
  </svg>
);

export const IconPlay = ({ size, className }: P) => (
  <svg width={size ?? 22} height={size ?? 22} viewBox="0 0 24 24" className={className}>
    <path d="M8 5.5v13a.6.6 0 0 0 .92.5l10.2-6.5a.6.6 0 0 0 0-1L8.92 5a.6.6 0 0 0-.92.5z" fill="currentColor" stroke="none" />
  </svg>
);

export const IconPause = ({ size, className }: P) => (
  <svg width={size ?? 22} height={size ?? 22} viewBox="0 0 24 24" className={className}>
    <rect x="7" y="5" width="3.4" height="14" rx="1" fill="currentColor" stroke="none" />
    <rect x="13.6" y="5" width="3.4" height="14" rx="1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconPrev = ({ size, className }: P) => (
  <svg width={size ?? 22} height={size ?? 22} viewBox="0 0 24 24" className={className}>
    <path d="M7 5v14" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    <path d="M17.5 6.2v11.6a.6.6 0 0 1-.92.5L8 12.6a.6.6 0 0 1 0-1l8.58-5.7a.6.6 0 0 1 .92.5z" fill="currentColor" stroke="none" />
  </svg>
);

export const IconNext = ({ size, className }: P) => (
  <svg width={size ?? 22} height={size ?? 22} viewBox="0 0 24 24" className={className}>
    <path d="M17 5v14" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    <path d="M6.5 6.2v11.6a.6.6 0 0 0 .92.5l8.58-5.7a.6.6 0 0 0 0-1L7.42 5.9a.6.6 0 0 0-.92.5z" fill="currentColor" stroke="none" />
  </svg>
);

export const IconShuffle = ({ size, className }: P) => (
  <svg {...S(size)} className={className}>
    <path d="M4 7h3.2c1.4 0 2.7.66 3.5 1.78l3.6 6.44A4.8 4.8 0 0 0 17.8 17H20" />
    <path d="M4 17h3.2c1.4 0 2.7-.66 3.5-1.78l.7-1.24M13.6 9.02l.7-1.24A4.8 4.8 0 0 1 17.8 6H20" />
    <path d="m18 3.5 2.5 2.5-2.5 2.5M18 15.5l2.5 2.5-2.5 2.5" />
  </svg>
);

export const IconRepeat = ({ size, className, active }: P & { active?: boolean }) => (
  <svg {...S(size)} className={className}>
    <path d="M4.5 9.5A5 5 0 0 1 9 5.5h7a4.5 4.5 0 0 1 0 9h-2" />
    <path d="M19.5 14.5A5 5 0 0 1 15 18.5H8a4.5 4.5 0 0 1-4-2.6" />
    <path d="m14.5 3 2.5 2.5-2.5 2.5M9.5 21 7 18.5 9.5 16" />
    {active && <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />}
  </svg>
);

export const IconHeart = ({ size, className, filled }: P & { filled?: boolean }) => (
  <svg {...S(size)} className={className} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 19.5s-7.5-4.6-7.5-9.7A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.2c0 5.1-7.5 9.7-7.5 9.7z" />
  </svg>
);

export const IconChevronDown = ({ size, className }: P) => (
  <svg {...S(size)} className={className}>
    <path d="m6 9.5 6 6 6-6" />
  </svg>
);

export const IconLogout = ({ size, className }: P) => (
  <svg {...S(size)} className={className}>
    <path d="M10 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
    <path d="M14 8l4 4-4 4M18 12H9" />
  </svg>
);

/** 4-Balken EQ: spielt nur, wenn active. transform-only. */
export const EqBars = ({ active, size = 14 }: { active: boolean; size?: number }) => (
  <span className={'eq' + (active ? ' eq-on' : '')} aria-hidden style={{ width: size, height: size }}>
    <i /><i /><i /><i />
  </span>
);
