/** Inline SVG tumbleweed – a tangled ball of brush strokes */
export function Tumbleweed({ size = 80 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Outer tangled shape */}
      <circle cx="50" cy="50" r="38" stroke="var(--tw-color, #8B6914)" strokeWidth="3" fill="var(--tw-fill, #C4A44A)" fillOpacity="0.25" />
      {/* Inner tangles */}
      <ellipse cx="50" cy="50" rx="30" ry="25" stroke="var(--tw-color, #8B6914)" strokeWidth="2" strokeDasharray="8 4" transform="rotate(25 50 50)" />
      <ellipse cx="50" cy="50" rx="28" ry="20" stroke="var(--tw-color, #8B6914)" strokeWidth="1.5" strokeDasharray="6 5" transform="rotate(-15 50 50)" />
      <ellipse cx="50" cy="50" rx="22" ry="30" stroke="var(--tw-color, #8B6914)" strokeWidth="1.5" strokeDasharray="5 6" transform="rotate(50 50 50)" />
      {/* Stray branches */}
      <path d="M 25 35 Q 40 20 55 38" stroke="var(--tw-color, #8B6914)" strokeWidth="2" strokeLinecap="round" />
      <path d="M 70 30 Q 60 50 75 65" stroke="var(--tw-color, #8B6914)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 30 65 Q 45 75 60 62" stroke="var(--tw-color, #8B6914)" strokeWidth="2" strokeLinecap="round" />
      <path d="M 38 25 Q 50 45 42 70" stroke="var(--tw-color, #8B6914)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 62 28 Q 50 48 65 72" stroke="var(--tw-color, #8B6914)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Inner dots – knots/thorns */}
      <circle cx="42" cy="42" r="2.5" fill="var(--tw-color, #8B6914)" fillOpacity="0.6" />
      <circle cx="58" cy="55" r="2" fill="var(--tw-color, #8B6914)" fillOpacity="0.6" />
      <circle cx="50" cy="38" r="1.8" fill="var(--tw-color, #8B6914)" fillOpacity="0.5" />
      <circle cx="45" cy="60" r="2.2" fill="var(--tw-color, #8B6914)" fillOpacity="0.5" />
    </svg>
  );
}
