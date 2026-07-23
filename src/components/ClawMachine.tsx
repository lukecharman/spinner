import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

const BALL_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F0B27A', '#82E0AA',
  '#F1948A', '#AED6F1', '#A3E4D7', '#FAD7A0',
];

type Phase = 'idle' | 'spinning' | 'done';

interface Props {
  members: string[];
  phase: Phase;
  winner: string | null;
  onTrigger: () => void;
}

interface BallLayout {
  cx: number;
  cy: number;
  color: string;
  rotation: number;
  hidden: boolean;
  inChute: boolean;
}

interface PhysBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
}

/* ── Physics constants ── */
const BALL_R = 15;
const GLOBE_CX = 160;
const GRAVITY = 500;
const BOUNCE = 0.45;
const FRICTION = 0.985;

/* Chute geometry — the rectangular opening in the pedestal */
const CHUTE_LEFT = 145;
const CHUTE_RIGHT = 175;
const CHUTE_TOP = 308;     // bottom of dome collar
const CHUTE_BOTTOM = 420;  // below visible SVG

/* The "hole" at the bottom of the dome: balls within this X range can pass through */
const HOLE_HALF_W = BALL_R + 4;

/* Dome top is at y≈42, bottom collar at y=308.
   Half-width varies with y to match the SVG path:
     y >= 190  → nearly straight sides, ~116 px from center
     y <  190  → narrows toward the top cap */
const DOME_TOP = 42;
const DOME_BOTTOM = 303;

function domeHalfWidth(y: number): number {
  if (y >= DOME_BOTTOM || y <= DOME_TOP) return 0;
  if (y >= 190) {
    // Lower dome: slight taper from 112 at collar to 116 at mid
    const t = (DOME_BOTTOM - y) / (DOME_BOTTOM - 190);
    return 112 + t * 4;
  }
  // Upper dome: narrows from 116 at y=190 to 0 at dome top
  const t = (y - DOME_TOP) / (190 - DOME_TOP);
  // Smooth curve matching the bezier bulge
  return 116 * Math.sqrt(t);
}

function constrainToDome(b: PhysBall, holeOpen: boolean) {
  // If hole is open and the ball is near the bottom center, let it through
  if (holeOpen && Math.abs(b.x - GLOBE_CX) < HOLE_HALF_W && b.y > 260) {
    return;
  }

  const hw = domeHalfWidth(b.y) - BALL_R;
  if (hw <= 0) {
    // Ball is outside dome vertically — push it back in
    if (b.y < DOME_TOP + BALL_R) {
      b.y = DOME_TOP + BALL_R;
      b.vy = Math.abs(b.vy) * BOUNCE;
    }
    if (b.y > DOME_BOTTOM - BALL_R) {
      b.y = DOME_BOTTOM - BALL_R;
      b.vy = -Math.abs(b.vy) * BOUNCE;
    }
    return;
  }

  const dx = b.x - GLOBE_CX;

  // Horizontal wall bounce
  if (Math.abs(dx) > hw) {
    const sign = dx > 0 ? 1 : -1;
    b.x = GLOBE_CX + sign * hw;

    // Compute wall normal (accounts for the dome narrowing upward)
    const hwAbove = domeHalfWidth(b.y - 1) - BALL_R;
    const slopeY = hw - hwAbove; // positive means wall narrows going up
    const nx = sign;
    const ny = -slopeY * sign;
    const nlen = Math.sqrt(nx * nx + ny * ny) || 1;
    const nnx = nx / nlen;
    const nny = ny / nlen;

    const dot = b.vx * nnx + b.vy * nny;
    if ((sign > 0 && b.vx > 0) || (sign < 0 && b.vx < 0)) {
      b.vx -= (1 + BOUNCE) * dot * nnx;
      b.vy -= (1 + BOUNCE) * dot * nny;
    }
  }

  // Floor
  if (b.y > DOME_BOTTOM - BALL_R) {
    b.y = DOME_BOTTOM - BALL_R;
    b.vy = -Math.abs(b.vy) * BOUNCE;
  }

  // Ceiling
  if (b.y < DOME_TOP + BALL_R) {
    b.y = DOME_TOP + BALL_R;
    b.vy = Math.abs(b.vy) * BOUNCE;
  }
}

/** Keep a ball inside the chute walls */
function constrainToChute(b: PhysBall) {
  if (b.y > CHUTE_TOP - BALL_R) {
    if (b.x - BALL_R < CHUTE_LEFT) {
      b.x = CHUTE_LEFT + BALL_R;
      b.vx = Math.abs(b.vx) * BOUNCE;
    }
    if (b.x + BALL_R > CHUTE_RIGHT) {
      b.x = CHUTE_RIGHT - BALL_R;
      b.vx = -Math.abs(b.vx) * BOUNCE;
    }
  }
}

function resolveBallCollision(a: PhysBall, b: PhysBall) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist2 = dx * dx + dy * dy;
  const minDist = BALL_R * 2;

  if (dist2 < minDist * minDist && dist2 > 0.001) {
    const dist = Math.sqrt(dist2);
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;

    a.x -= nx * overlap * 0.5;
    a.y -= ny * overlap * 0.5;
    b.x += nx * overlap * 0.5;
    b.y += ny * overlap * 0.5;

    const relVn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (relVn > 0) {
      const impulse = relVn * (1 + BOUNCE) * 0.5;
      a.vx -= impulse * nx;
      a.vy -= impulse * ny;
      b.vx += impulse * nx;
      b.vy += impulse * ny;
    }
  }
}

function createPhysicsBalls(count: number): PhysBall[] {
  return Array.from({ length: count }, () => {
    const y = DOME_TOP + BALL_R + Math.random() * (DOME_BOTTOM - DOME_TOP - BALL_R * 2);
    const hw = domeHalfWidth(y) - BALL_R - 2;
    const x = GLOBE_CX + (Math.random() - 0.5) * 2 * Math.max(hw, 0);
    return {
      x,
      y,
      vx: (Math.random() - 0.5) * 40,
      vy: 0,
      rot: Math.random() * 360,
    };
  });
}

export function ClawMachine({ members, phase, winner, onTrigger }: Props) {
  const winnerIdx = winner ? members.indexOf(winner) : -1;
  const [balls, setBalls] = useState<BallLayout[]>([]);
  const [buttonPressed, setButtonPressed] = useState(false);
  const paperRotation = useMemo(() => {
    if (!winner) return 0;
    let h = 0;
    for (let i = 0; i < winner.length; i++) h = (h * 31 + winner.charCodeAt(i)) | 0;
    return ((Math.abs(h) % 1000) / 1000) * 10 - 5;
  }, [winner]);
  const physRef = useRef<PhysBall[]>([]);
  const rafRef = useRef(0);
  const dispensingRef = useRef(false);
  const guidingRef = useRef(false);
  const winnerIdxRef = useRef(-1);
  const dispensedRef = useRef(false);
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
    winnerIdxRef.current = winnerIdx;
  }, [phase, winnerIdx]);

  const runSim = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    let lastTime = performance.now();
    let settleCount = 0;
    const GUIDE_STRENGTH = 600;   // force pulling winner to center-bottom
    const REPEL_STRENGTH = 300;   // force pushing others away from center-bottom

    const targetX = GLOBE_CX;
    const targetY = DOME_BOTTOM - BALL_R;

    function step(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.018);
      lastTime = now;
      const phys = physRef.current;
      if (phys.length === 0) return;
      const dispensing = dispensingRef.current;
      const guiding = guidingRef.current;
      const wIdx = winnerIdxRef.current;

      for (let i = 0; i < phys.length; i++) {
        const b = phys[i];

        // Apply guiding forces during agitation settling
        if (guiding && wIdx >= 0) {
          if (i === wIdx) {
            // Pull winner toward center-bottom
            const dx = targetX - b.x;
            const dy = targetY - b.y;
            b.vx += dx * GUIDE_STRENGTH * dt / Math.max(Math.abs(dx), 20);
            b.vy += dy * GUIDE_STRENGTH * dt / Math.max(Math.abs(dy), 20);
          } else {
            // Repel others away from center-bottom to clear a lane
            const dx = b.x - targetX;
            const dy = b.y - targetY;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            if (dist < 70) {
              // Push sideways (not down) to get them out of the way
              const pushX = dx / dist;
              b.vx += pushX * REPEL_STRENGTH * dt;
              b.vy -= REPEL_STRENGTH * 0.3 * dt; // nudge upward
            }
          }
        }

        b.vy += GRAVITY * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.rot += (b.vx / BALL_R) * (180 / Math.PI) * dt;
        b.vx *= FRICTION;
        b.vy *= FRICTION;

        if (dispensing && i === wIdx) {
          constrainToChute(b);
          if (b.y > CHUTE_BOTTOM) {
            dispensedRef.current = true;
            // Freeze all remaining balls in place
            for (let j = 0; j < phys.length; j++) {
              if (j !== wIdx) { phys[j].vx = 0; phys[j].vy = 0; }
            }
          }
        }
      }

      for (let pass = 0; pass < 4; pass++) {
        for (let i = 0; i < phys.length; i++) {
          for (let j = i + 1; j < phys.length; j++) {
            if (dispensing && (i === wIdx || j === wIdx)) continue;
            resolveBallCollision(phys[i], phys[j]);
          }
        }
        for (let i = 0; i < phys.length; i++) {
          const isWinnerBall = dispensing && i === wIdx;
          constrainToDome(phys[i], isWinnerBall);
        }
      }

      let energy = 0;
      for (const b of phys) energy += b.vx * b.vx + b.vy * b.vy;

      setBalls(phys.map((b, i) => ({
        cx: b.x,
        cy: b.y,
        color: BALL_COLORS[i % BALL_COLORS.length],
        rotation: b.rot,
        hidden: i === wIdx && dispensedRef.current,
        inChute: dispensing && i === wIdx && b.y > CHUTE_TOP - BALL_R,
      })));

      // Stop the sim once the winner has exited
      if (dispensedRef.current) return;

      if (energy < phys.length * 0.2) {
        settleCount++;
        if (settleCount > 40 && !guiding && !dispensing) return;
      } else {
        settleCount = 0;
      }

      rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);
  }, []);

  // Initialise / reset physics when members list changes
  useEffect(() => {
    if (members.length === 0) {
      physRef.current = [];
      return;
    }

    // Don't re-scatter while spinning or showing the result
    if (phaseRef.current === 'spinning' || phaseRef.current === 'done') return;

    // Scatter balls randomly throughout the dome, let them settle under gravity
    physRef.current = createPhysicsBalls(members.length);

    // Let them settle gently under gravity (no initial velocity)
    runSim();
    return () => cancelAnimationFrame(rafRef.current);
  }, [members, runSim]);

  // Agitate balls then dispense the winner
  useEffect(() => {
    if (phase !== 'spinning' || winnerIdx < 0) return;

    dispensingRef.current = false;
    guidingRef.current = false;
    dispensedRef.current = false;

    if (
      physRef.current.length !== members.length
      || physRef.current.some(ball => ball.y > DOME_BOTTOM || ball.y < DOME_TOP)
    ) {
      physRef.current = createPhysicsBalls(members.length);
    }

    // Three big jostles over 5 seconds
    const jostle = () => {
      for (const b of physRef.current) {
        b.vx += (Math.random() - 0.5) * 700;
        b.vy -= 300 + Math.random() * 400;
      }
      runSim();
    };

    jostle();
    const jostle2 = setTimeout(jostle, 1700);
    const jostle3 = setTimeout(jostle, 3400);

    // After jostling, start guiding the winner to the bottom
    const guideTimer = setTimeout(() => {
      guidingRef.current = true;
      runSim();
    }, 4000);

    // Once guided into position, stop guiding and open the hole
    const dispenseTimer = setTimeout(() => {
      guidingRef.current = false;
      dispensingRef.current = true;
      const wb = physRef.current[winnerIdx];
      if (wb) {
        wb.vy = 300;
      }
      runSim();
    }, 5500);

    return () => {
      clearTimeout(jostle2);
      clearTimeout(jostle3);
      clearTimeout(guideTimer);
      clearTimeout(dispenseTimer);
      cancelAnimationFrame(rafRef.current);
    };
  }, [members.length, phase, winnerIdx, runSim]);

  // Reset state when back to idle
  useEffect(() => {
    if (phase === 'idle') {
      dispensingRef.current = false;
      guidingRef.current = false;
      dispensedRef.current = false;
    }
  }, [phase]);

  const winnerColor = winnerIdx >= 0 ? balls[winnerIdx]?.color ?? '#FF6B6B' : '#FF6B6B';

  return (
    <div
      className="capsule-machine"
    >
      <svg viewBox="0 0 320 400" className="capsule-svg">
        <defs>
          <clipPath id="chute-clip">
            <rect x="118" y="356" width="84" height="35" />
          </clipPath>
          <linearGradient id="body-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e74c3c" />
            <stop offset="100%" stopColor="#c0392b" />
          </linearGradient>
          <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ccc" />
            <stop offset="45%" stopColor="#999" />
            <stop offset="55%" stopColor="#888" />
            <stop offset="100%" stopColor="#666" />
          </linearGradient>
          <radialGradient id="dome-sheen" cx="0.3" cy="0.3" r="0.65">
            <stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* ── Base platform ── */}
        <rect x="55" y="384" width="210" height="12" rx="4" fill="url(#chrome)" stroke="#555" strokeWidth="1" />

        {/* ── Machine body ── */}
        <rect x="70" y="308" width="180" height="80" rx="10" fill="url(#body-grad)" stroke="#922" strokeWidth="2" />
        {/* Panel inset */}
        <rect x="82" y="315" width="156" height="66" rx="6" fill="rgba(0,0,0,0.12)" />
        {/* Trim line */}
        <line x1="82" y1="350" x2="238" y2="350" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

        {/* ── Chute opening ── */}
        <rect x="115" y="356" width="90" height="28" rx="10" fill="#0d0d1a" stroke="#2a2a3e" strokeWidth="1.5" />
        <rect x="122" y="360" width="76" height="18" rx="7" fill="#060610" />

        {/* ── Dome ── */}
        <path
          className="capsule-dome-outline capsule-dome-fill"
          d="M 48 308 C 46 268 44 228 44 190 C 44 95 82 44 160 38 C 238 44 276 95 276 190 C 276 228 274 268 272 308 Z"
          fill="rgba(200,225,255,0.06)"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="2"
        />
        {/* Dome sheen */}
        <path
          d="M 48 308 C 46 268 44 228 44 190 C 44 95 82 44 160 38 C 238 44 276 95 276 190 C 276 228 274 268 272 308 Z"
          fill="url(#dome-sheen)"
        />
        {/* Left reflection streak */}
        <path
          d="M 72 280 C 64 215 66 135 96 72"
          fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="4" strokeLinecap="round"
        />
        {/* Top highlight */}
        <ellipse cx="125" cy="72" rx="18" ry="7" fill="rgba(255,255,255,0.05)" transform="rotate(-10, 125, 72)" />

        {/* ── Dome collar ── */}
        <rect x="42" y="302" width="236" height="14" rx="5" fill="url(#chrome)" stroke="#555" strokeWidth="1.5" />
        <rect x="46" y="303" width="228" height="5" rx="2.5" fill="rgba(255,255,255,0.12)" />

        {/* ── Top cap ── */}
        <circle cx="160" cy="40" r="14" fill="url(#chrome)" stroke="#555" strokeWidth="1.5" />
        <circle cx="160" cy="40" r="8" fill="#aaa" stroke="#888" strokeWidth="1" />
        <circle cx="157" cy="37" r="3" fill="rgba(255,255,255,0.35)" />

        {/* ── Capsules inside the dome ── */}
        {members.length > 0 && balls.map((ball, i) => {
          const isWinner = i === winnerIdx;
          const gone = isWinner && phase === 'done';
          if (gone || ball.hidden) return null;
          const inChute = ball.inChute;

          return (
            <g
              key={i}
              clipPath={inChute ? 'url(#chute-clip)' : undefined}
              transform={`rotate(${ball.rotation}, ${ball.cx}, ${ball.cy})`}
            >
              <circle cx={ball.cx} cy={ball.cy} r="15" fill={ball.color} stroke="rgba(0,0,0,0.12)" strokeWidth="1" />
              <path
                d={`M ${ball.cx - 15} ${ball.cy} A 15 15 0 0 1 ${ball.cx + 15} ${ball.cy}`}
                fill="rgba(255,255,255,0.2)"
              />
              <line x1={ball.cx - 14} y1={ball.cy} x2={ball.cx + 14} y2={ball.cy} stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
              <circle cx={ball.cx - 4} cy={ball.cy - 5} r="3.5" fill="rgba(255,255,255,0.35)" />
              <text
                x={ball.cx} y={ball.cy + 1.5}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="12" fontWeight="800"
                fill="rgba(255,255,255,0.45)"
                fontFamily="system-ui"
              >?</text>
            </g>
          );
        })}

        {/* ── Turn dial ── */}
        <g
          className="capsule-button"
          onClick={phase !== 'spinning' && members.length > 0 ? onTrigger : undefined}
          onPointerDown={() => { if (phase !== 'spinning' && members.length > 0) setButtonPressed(true); }}
          onPointerUp={() => setButtonPressed(false)}
          onPointerLeave={() => setButtonPressed(false)}
          style={{ cursor: phase !== 'spinning' && members.length > 0 ? 'pointer' : 'default' }}
        >
          {/* Dial housing */}
          <circle cx="160" cy="333" r="18" fill="#555" stroke="#444" strokeWidth="2" />
          {/* Dial face — rotates on spin */}
          <g className={`capsule-button-inner ${buttonPressed ? 'capsule-button-down' : ''} ${phase === 'spinning' ? 'capsule-button-pressed' : ''}`}>
            <circle className="capsule-button-face" cx="160" cy="333" r="14" fill="#FFD700" stroke="#CC9900" strokeWidth="1.5" />
            {/* Cross groove */}
            <line x1="150" y1="333" x2="170" y2="333" stroke="rgba(0,0,0,0.2)" strokeWidth="2" strokeLinecap="round" />
            <line x1="160" y1="323" x2="160" y2="343" stroke="rgba(0,0,0,0.2)" strokeWidth="2" strokeLinecap="round" />
            {/* Highlight */}
            <circle cx="155" cy="328" r="4" fill="rgba(255,255,255,0.3)" />
          </g>
        </g>

        {/* Idle prompt */}
        {phase === 'idle' && members.length > 0 && (
          <text x="160" y="200" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.3)" fontWeight="600" fontFamily="system-ui">
            Turn the dial!
          </text>
        )}
      </svg>

      {/* ── Winner capsule: rises from the chute and opens ── */}
      {phase === 'done' && winner && (
        <div className="capsule-chute-reveal" style={{ '--capsule-color': winnerColor } as React.CSSProperties}>
          <div className="capsule-chute-ball">
            <div className="capsule-chute-top" />
            <div className="capsule-chute-bottom" />
            {/* Paper slip unfurls from inside */}
            <div className="capsule-paper-slip" style={{ '--paper-rotation': `${paperRotation}deg` } as React.CSSProperties}>
              <div className="capsule-paper-inner">
                <span className="capsule-paper-star">★</span>
                <span className="capsule-paper-name">{winner}</span>
                <span className="capsule-paper-star">★</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
