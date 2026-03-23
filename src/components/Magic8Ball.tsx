import { useState, useEffect, useRef, useCallback } from 'react';

interface FloatingName {
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
}

const WINDOW_CX = 120;
const WINDOW_CY = 115;
const WINDOW_R = 44; // keep names inside the window circle with padding

/** Inline SVG Magic 8-Ball */
export function Magic8Ball({
  size = 480,
  answer,
  phase,
  members = [],
}: {
  size?: number;
  answer?: string | null;
  phase: 'idle' | 'shaking' | 'clearing' | 'done';
  members?: string[];
}) {
  const showAnswer = phase === 'done' && answer;

  // Floating names state
  const [floaters, setFloaters] = useState<FloatingName[]>([]);
  const rafRef = useRef<number>(0);
  const floatersRef = useRef<FloatingName[]>([]);

  const initFloaters = useCallback(() => {
    const items: FloatingName[] = members.map((name, i) => {
      const angle = (i / members.length) * Math.PI * 2;
      const dist = 10 + Math.random() * 20;
      return {
        name,
        x: WINDOW_CX + Math.cos(angle) * dist,
        y: WINDOW_CY + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 2.5,
        vy: (Math.random() - 0.5) * 2.5,
        opacity: 0.5 + Math.random() * 0.4,
      };
    });
    floatersRef.current = items;
    setFloaters(items);
  }, [members]);

  useEffect(() => {
    if (phase === 'shaking' && members.length > 0) {
      initFloaters();

      const animate = () => {
        floatersRef.current = floatersRef.current.map(f => {
          let { x, y, vx, vy } = f;
          x += vx;
          y += vy;

          // Bounce off circular boundary
          const dx = x - WINDOW_CX;
          const dy = y - WINDOW_CY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > WINDOW_R) {
            // Reflect velocity off the circle normal
            const nx = dx / dist;
            const ny = dy / dist;
            const dot = vx * nx + vy * ny;
            vx -= 2 * dot * nx;
            vy -= 2 * dot * ny;
            // Push back inside
            x = WINDOW_CX + nx * WINDOW_R;
            y = WINDOW_CY + ny * WINDOW_R;
            // Add randomness on bounce
            vx += (Math.random() - 0.5) * 1.2;
            vy += (Math.random() - 0.5) * 1.2;
          }

          // Random jitter to keep it chaotic
          vx += (Math.random() - 0.5) * 0.4;
          vy += (Math.random() - 0.5) * 0.4;

          // Clamp speed
          const speed = Math.sqrt(vx * vx + vy * vy);
          const maxSpeed = 3;
          if (speed > maxSpeed) {
            vx = (vx / speed) * maxSpeed;
            vy = (vy / speed) * maxSpeed;
          }

          return { ...f, x, y, vx, vy };
        });
        setFloaters([...floatersRef.current]);
        rafRef.current = requestAnimationFrame(animate);
      };

      rafRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(rafRef.current);
      if (phase !== 'shaking') setFloaters([]);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, members, initFloaters]);

  // Compute font size based on answer length
  const answerFontSize = answer
    ? answer.length <= 6 ? 32 : answer.length <= 10 ? 26 : answer.length <= 15 ? 22 : 18
    : 22;

  // Font size for floating names — smaller when there are many
  const floaterFontSize = members.length <= 4 ? 11 : members.length <= 7 ? 9 : 7;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`magic8ball-svg ${phase}`}
    >
      {/* Shadow under ball */}
      <ellipse cx="120" cy="228" rx="70" ry="10" fill="rgba(0,0,0,0.18)" />

      {/* Main ball body */}
      <circle cx="120" cy="115" r="105" fill="#1a1a2e" />
      <circle cx="120" cy="115" r="105" fill="url(#ballGrad)" />

      {/* Glossy highlight */}
      <ellipse cx="95" cy="70" rx="50" ry="35" fill="white" fillOpacity="0.12" />
      <ellipse cx="85" cy="60" rx="25" ry="15" fill="white" fillOpacity="0.08" />

      {/* Number 8 */}
      <text
        x="165"
        y="85"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontFamily="serif"
        fontWeight="bold"
        fontSize="36"
        fillOpacity="0.3"
      >
        8
      </text>

      {/* Blue window (answer triangle area) */}
      <circle cx="120" cy="115" r="52" fill="#0a1628" />
      <circle cx="120" cy="115" r="52" fill="url(#windowGrad)" />

      {/* Floating names during shake — clipped to window circle */}
      {phase === 'shaking' && floaters.length > 0 && (
        <g clipPath="url(#windowClip)">
          {floaters.map((f, i) => (
            <text
              key={i}
              x={f.x}
              y={f.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#4a7faa"
              fontFamily="system-ui, sans-serif"
              fontWeight="600"
              fontSize={floaterFontSize}
              fillOpacity={f.opacity}
            >
              {f.name}
            </text>
          ))}
        </g>
      )}

      {/* Murky fluid overlay — visible during clearing */}
      {phase === 'clearing' && (
        <circle
          cx="120"
          cy="115"
          r="50"
          className="murky-fluid"
          fill="url(#murkyGrad)"
        />
      )}

      {/* Answer triangle */}
      <polygon
        points="120,78 152,137 88,137"
        fill="none"
        stroke="#1e3a5f"
        strokeWidth="1.5"
        strokeOpacity={showAnswer ? 0.5 : 0.15}
      />

      {/* Answer text */}
      {showAnswer && (
        <text
          x="120"
          y="113"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#7eb8ff"
          fontFamily="system-ui, sans-serif"
          fontWeight="700"
          fontSize={answerFontSize}
          className="answer-text"
        >
          {splitName(answer, 10).map((line, i, arr) => (
            <tspan
              key={i}
              x="120"
              dy={i === 0 ? -((arr.length - 1) * answerFontSize * 0.55) : answerFontSize * 1.1}
            >
              {line}
            </tspan>
          ))}
        </text>
      )}

      {/* "is hosting!" sub-label after answer */}
      {showAnswer && (
        <text
          x="120"
          y="140"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#4a7faa"
          fontFamily="system-ui, sans-serif"
          fontWeight="500"
          fontSize="9"
          className="answer-text"
          fillOpacity="0.8"
        >
          is hosting today!
        </text>
      )}

      {/* Idle prompt text */}
      {phase === 'idle' && !answer && (
        <text
          x="120"
          y="115"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#4a6d8c"
          fontFamily="system-ui, sans-serif"
          fontWeight="500"
          fontSize="14"
          fillOpacity="0.7"
        >
          Shake me
        </text>
      )}

      {/* Gradient definitions */}
      <defs>
        <clipPath id="windowClip">
          <circle cx="120" cy="115" r="50" />
        </clipPath>
        <radialGradient id="ballGrad" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#3a3a5e" />
          <stop offset="50%" stopColor="#1a1a2e" />
          <stop offset="100%" stopColor="#0d0d1a" />
        </radialGradient>
        <radialGradient id="windowGrad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#0f2744" />
          <stop offset="100%" stopColor="#06101f" />
        </radialGradient>
        <radialGradient id="murkyGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0a1a30" stopOpacity="0.6" />
          <stop offset="60%" stopColor="#081428" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#050e1c" stopOpacity="0.95" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** Split a name into lines for the triangle window */
function splitName(name: string, maxLen: number): string[] {
  if (name.length <= maxLen) return [name];
  const words = name.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current && (current + ' ' + word).length > maxLen) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
