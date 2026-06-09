import { useMemo, useRef, useCallback } from 'react';

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F0B27A', '#82E0AA',
  '#F1948A', '#AED6F1', '#A3E4D7', '#FAD7A0',
];

interface Props {
  members: string[];
  rotation: number;
  dragOffset: number;
  isDragging: boolean;
  phase: 'idle' | 'spinning' | 'done';
  winner: string | null;
  onSpin?: () => void;
  onFlick?: (velocity: number) => void;
  onDragStart?: () => void;
  onDragMove?: (angleDelta: number) => void;
  onDragEnd?: (velocity: number) => void;
}

export function WheelOfFortune({
  members, rotation, dragOffset, isDragging: dragging,
  phase, winner, onDragStart, onDragMove, onDragEnd,
}: Props) {
  const n = members.length;
  const sliceAngle = n > 0 ? 360 / n : 360;

  // Drag tracking
  const containerRef = useRef<HTMLDivElement>(null);
  const lastAngle = useRef<number | null>(null);
  const velocitySamples = useRef<{ angle: number; time: number }[]>([]);
  const pointerDown = useRef(false);

  /** Get angle (degrees) from wheel center to a screen point */
  const getAngle = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (phase === 'spinning') return;
    pointerDown.current = true;
    lastAngle.current = getAngle(e.clientX, e.clientY);
    velocitySamples.current = [{ angle: 0, time: Date.now() }];
    onDragStart?.();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [phase, getAngle, onDragStart]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerDown.current || lastAngle.current === null) return;

    const currentAngle = getAngle(e.clientX, e.clientY);
    let delta = currentAngle - lastAngle.current;

    // Normalize to [-180, 180] to handle wrap-around
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    lastAngle.current = currentAngle;

    // Track velocity samples (keep last 80ms worth)
    const now = Date.now();
    const cumulative = (velocitySamples.current.at(-1)?.angle ?? 0) + delta;
    velocitySamples.current.push({ angle: cumulative, time: now });
    velocitySamples.current = velocitySamples.current.filter(s => now - s.time < 80);

    onDragMove?.(delta);
  }, [getAngle, onDragMove]);

  const handlePointerUp = useCallback(() => {
    if (!pointerDown.current) return;
    pointerDown.current = false;

    const samples = velocitySamples.current;
    lastAngle.current = null;

    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = (last.time - first.time) / 1000; // seconds
      const dAngle = last.angle - first.angle;
      const velocity = dt > 0 ? dAngle / dt : 0; // degrees per second

      // If there's meaningful velocity, flick; otherwise treat as tap
      if (Math.abs(velocity) > 60) {
        onDragEnd?.(velocity);
        return;
      }
    }

    // Tap / no meaningful drag → simple spin
    onDragEnd?.(0);
  }, [onDragEnd]);

  const totalRotation = rotation + dragOffset;
  const winnerIndex = phase === 'done' && winner ? members.indexOf(winner) : -1;

  const slices = useMemo(() => {
    if (n === 0) return [];
    return members.map((name, i) => {
      const startAngle = i * sliceAngle;
      const endAngle = startAngle + sliceAngle;
      const startRad = (startAngle - 90) * (Math.PI / 180);
      const endRad = (endAngle - 90) * (Math.PI / 180);
      const r = 145;
      const cx = 160, cy = 160;

      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);

      const largeArc = sliceAngle > 180 ? 1 : 0;

      const path = n === 1
        ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

      // Label position — halfway through the slice, 60% out from center
      const color = COLORS[i % COLORS.length];

      // Compute font size based on number of slices
      const maxChars = n <= 4 ? 14 : n <= 8 ? 10 : 8;
      const displayName = name.length > maxChars ? name.slice(0, maxChars - 1) + '…' : name;
      const fontSize = n <= 4 ? 14 : n <= 8 ? 11 : 9;

      // Arc path for curved text along the outer edge
      // We place text at ~85% of the radius, curving from start to end of the slice
      const textR = r * 0.82;
      // Inset the arc slightly from slice edges so text doesn't touch borders
      const insetDeg = Math.min(sliceAngle * 0.08, 3);
      const arcStart = startAngle + insetDeg;
      const arcEnd = endAngle - insetDeg;
      const arcStartRad = (arcStart - 90) * (Math.PI / 180);
      const arcEndRad = (arcEnd - 90) * (Math.PI / 180);
      const ax1 = cx + textR * Math.cos(arcStartRad);
      const ay1 = cy + textR * Math.sin(arcStartRad);
      const ax2 = cx + textR * Math.cos(arcEndRad);
      const ay2 = cy + textR * Math.sin(arcEndRad);
      const arcSpan = arcEnd - arcStart;
      const arcLargeArc = arcSpan > 180 ? 1 : 0;
      const textArcPath = `M ${ax1} ${ay1} A ${textR} ${textR} 0 ${arcLargeArc} 1 ${ax2} ${ay2}`;
      const textPathId = `textArc-${i}`;

      return { path, color, displayName, fontSize, textArcPath, textPathId };
    });
  }, [members, n, sliceAngle]);

  return (
    <div
      ref={containerRef}
      className="wheel-container"
      style={{
        cursor: phase === 'spinning' ? 'default' : dragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Pointer at top */}
      <div className="wheel-pointer" />

      <svg
        viewBox="0 0 320 320"
        className="wheel-svg"
      >
        {/* Outer ring shadow */}
        <circle cx="160" cy="160" r="150" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="6" />

        {/* Wheel group — rotates */}
        <g
          style={{
            transform: `rotate(${totalRotation}deg)`,
            transformBox: 'fill-box',
            transformOrigin: 'center',
            transition: phase === 'spinning' && !dragging
              ? 'transform 7s cubic-bezier(0.12, 0.6, 0.08, 1)'
              : 'none',
          }}
        >
          {/* Define arc paths for curved text */}
          <defs>
            {slices.map((s, i) => (
              <path key={i} id={s.textPathId} d={s.textArcPath} fill="none" />
            ))}
          </defs>

          {slices.map((s, i) => (
            <g key={i}>
              <path
                d={s.path}
                fill={s.color}
                stroke={i === winnerIndex ? 'white' : 'white'}
                strokeWidth={i === winnerIndex ? '3' : '1.5'}
                className={i === winnerIndex ? 'winner-slice' : undefined}
              />
              <text
                fill="white"
                fontFamily="system-ui, sans-serif"
                fontWeight="700"
                fontSize={s.fontSize}
                paintOrder="stroke"
                stroke="rgba(0,0,0,0.25)"
                strokeWidth="2.5"
              >
                <textPath
                  href={`#${s.textPathId}`}
                  startOffset="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {s.displayName}
                </textPath>
              </text>
            </g>
          ))}

          {/* Center hub */}
          <circle cx="160" cy="160" r="18" fill="white" stroke="#ddd" strokeWidth="2" />
          <circle cx="160" cy="160" r="8" fill="#ccc" />
        </g>

        {/* Outer decorative ring */}
        <circle cx="160" cy="160" r="148" fill="none" stroke="white" strokeWidth="3" strokeOpacity="0.5" />
      </svg>
    </div>
  );
}
