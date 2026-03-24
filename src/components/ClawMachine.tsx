import { useEffect, useRef, useState, useCallback } from 'react';

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
}

interface PhysBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/* ── Physics constants ── */
const BALL_R = 15;
const GLOBE_CX = 160;
const GLOBE_CY = 180;
const GLOBE_RX = 110;
const GLOBE_RY = 130;
const GRAVITY = 500;
const BOUNCE = 0.45;
const FRICTION = 0.985;

/* Chute geometry — the rectangular opening in the pedestal */
const CHUTE_LEFT = 145;
const CHUTE_RIGHT = 175;
const CHUTE_TOP = 308;     // bottom of globe rim
const CHUTE_BOTTOM = 420;  // below visible SVG

/* The "hole" at the bottom of the ellipse: balls within this X range can pass through */
const HOLE_HALF_W = BALL_R + 4;

function constrainToEllipse(b: PhysBall, holeOpen: boolean) {
  // If hole is open and the ball is near the bottom center, let it through
  if (holeOpen && Math.abs(b.x - GLOBE_CX) < HOLE_HALF_W && b.y > GLOBE_CY + GLOBE_RY * 0.6) {
    return;
  }

  const erx = GLOBE_RX - BALL_R;
  const ery = GLOBE_RY - BALL_R;
  const dx = b.x - GLOBE_CX;
  const dy = b.y - GLOBE_CY;
  const d2 = (dx * dx) / (erx * erx) + (dy * dy) / (ery * ery);

  if (d2 > 1) {
    const d = Math.sqrt(d2);
    b.x = GLOBE_CX + (dx / d);
    b.y = GLOBE_CY + (dy / d);

    const gnx = 2 * (b.x - GLOBE_CX) / (erx * erx);
    const gny = 2 * (b.y - GLOBE_CY) / (ery * ery);
    const glen = Math.sqrt(gnx * gnx + gny * gny) || 1;
    const nx = gnx / glen;
    const ny = gny / glen;

    const dot = b.vx * nx + b.vy * ny;
    if (dot > 0) {
      b.vx -= (1 + BOUNCE) * dot * nx;
      b.vy -= (1 + BOUNCE) * dot * ny;
    }
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

export function ClawMachine({ members, phase, winner, onTrigger }: Props) {
  const winnerIdx = winner ? members.indexOf(winner) : -1;
  const [balls, setBalls] = useState<BallLayout[]>([]);
  const [buttonPressed, setButtonPressed] = useState(false);
  const physRef = useRef<PhysBall[]>([]);
  const rafRef = useRef(0);
  const dispensingRef = useRef(false);
  const guidingRef = useRef(false);
  const winnerIdxRef = useRef(-1);
  const dispensedRef = useRef(false);

  winnerIdxRef.current = winnerIdx;

  const runSim = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    let lastTime = performance.now();
    let settleCount = 0;
    const GUIDE_STRENGTH = 600;   // force pulling winner to center-bottom
    const REPEL_STRENGTH = 300;   // force pushing others away from center-bottom

    const targetX = GLOBE_CX;
    const targetY = GLOBE_CY + GLOBE_RY - BALL_R;

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
            if (dist < GLOBE_RX * 0.6) {
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
        b.vx *= FRICTION;
        b.vy *= FRICTION;

        if (dispensing && i === wIdx) {
          constrainToChute(b);
          if (b.y > CHUTE_BOTTOM) {
            dispensedRef.current = true;
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
          constrainToEllipse(phys[i], isWinnerBall);
        }
      }

      let energy = 0;
      for (const b of phys) energy += b.vx * b.vx + b.vy * b.vy;

      setBalls(phys.map((b, i) => ({
        cx: b.x,
        cy: b.y,
        color: BALL_COLORS[i % BALL_COLORS.length],
      })));

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
      setBalls([]);
      physRef.current = [];
      return;
    }

    // Place balls in a rough grid at the bottom of the ellipse, zero velocity
    const cols = Math.min(members.length, 6);
    physRef.current = members.map((_, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const rowCount = Math.min(members.length - row * cols, cols);
      const rowWidth = rowCount * (BALL_R * 2.2);
      const startX = GLOBE_CX - rowWidth / 2 + BALL_R;
      return {
        x: startX + col * (BALL_R * 2.2),
        y: GLOBE_CY + GLOBE_RY - BALL_R * 2 - row * (BALL_R * 2.2),
        vx: 0,
        vy: 0,
      };
    });

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

    // Agitate all balls with random impulses
    for (const b of physRef.current) {
      b.vx += (Math.random() - 0.5) * 250;
      b.vy -= 100 + Math.random() * 150;
    }
    runSim();

    // After initial bounce, start guiding the winner to the bottom
    const guideTimer = setTimeout(() => {
      guidingRef.current = true;
      runSim();
    }, 600);

    // Once guided into position, stop guiding and open the hole
    const dispenseTimer = setTimeout(() => {
      guidingRef.current = false;
      dispensingRef.current = true;
      const wb = physRef.current[winnerIdx];
      if (wb) {
        // Small downward nudge — it should already be at the bottom
        wb.vy = 150;
      }
      runSim();
    }, 2200);

    return () => {
      clearTimeout(guideTimer);
      clearTimeout(dispenseTimer);
      cancelAnimationFrame(rafRef.current);
    };
  }, [phase, winnerIdx, runSim]);

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
          {/* Clip path so the winner ball is only visible inside the chute opening */}
          <clipPath id="chute-clip">
            <rect x="130" y="350" width="60" height="40" />
          </clipPath>
        </defs>
        {/* ── Machine body ── */}
        {/* Base / pedestal */}
        <rect x="100" y="310" width="120" height="80" rx="8" fill="#555" stroke="#444" strokeWidth="2" />
        <rect x="90" y="380" width="140" height="12" rx="4" fill="#666" stroke="#555" strokeWidth="1.5" />

        {/* Dispense chute opening */}
        <rect x="130" y="350" width="60" height="35" rx="6" fill="#1a1a2e" stroke="#333" strokeWidth="1.5" />

        {/* Globe / dome — the transparent dome holding the capsules */}
        <ellipse cx="160" cy="180" rx="110" ry="130" fill="rgba(200,220,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
        {/* Globe shine */}
        <ellipse cx="120" cy="120" rx="30" ry="50" fill="rgba(255,255,255,0.04)" transform="rotate(-15, 120, 120)" />

        {/* Metal rim at dome base */}
        <ellipse cx="160" cy="308" rx="65" ry="8" fill="#666" stroke="#555" strokeWidth="1.5" />

        {/* ── Capsules inside the globe ── */}
        {balls.map((ball, i) => {
          const isWinner = i === winnerIdx;
          const gone = isWinner && phase === 'done';
          // Hide winner once it's below the chute or phase is done
          if (gone || (isWinner && dispensedRef.current)) return null;
          // If winner is in the chute, clip it to the chute opening
          const inChute = isWinner && dispensingRef.current && ball.cy > CHUTE_TOP - BALL_R;

          return (
            <g
              key={i}
              clipPath={inChute ? 'url(#chute-clip)' : undefined}
            >
              {/* Ball body */}
              <circle cx={ball.cx} cy={ball.cy} r="15" fill={ball.color} stroke="rgba(0,0,0,0.12)" strokeWidth="1" />
              {/* Top half highlight */}
              <path
                d={`M ${ball.cx - 15} ${ball.cy} A 15 15 0 0 1 ${ball.cx + 15} ${ball.cy}`}
                fill="rgba(255,255,255,0.2)"
              />
              {/* Seam */}
              <line x1={ball.cx - 14} y1={ball.cy} x2={ball.cx + 14} y2={ball.cy} stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
              {/* Shine */}
              <circle cx={ball.cx - 4} cy={ball.cy - 5} r="3.5" fill="rgba(255,255,255,0.35)" />
              {/* Question mark */}
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

        {/* ── Push button on the front ── */}
        <g
          className="capsule-button"
          onClick={phase === 'idle' && members.length > 0 ? onTrigger : undefined}
          onPointerDown={() => { if (phase === 'idle' && members.length > 0) setButtonPressed(true); }}
          onPointerUp={() => setButtonPressed(false)}
          onPointerLeave={() => setButtonPressed(false)}
          style={{ cursor: phase === 'idle' && members.length > 0 ? 'pointer' : 'default' }}
        >
          {/* Button housing (grey frame — stays still) */}
          <rect x="135" y="318" width="50" height="28" rx="6" fill="#444" stroke="#333" strokeWidth="1.5" />
          {/* Red button face — scales on press */}
          <g className={`capsule-button-inner ${buttonPressed ? 'capsule-button-down' : ''} ${phase === 'spinning' ? 'capsule-button-pressed' : ''}`}>
            <rect className="capsule-button-face" x="140" y="320" width="40" height="20" rx="4" fill="#e74c3c" stroke="#c0392b" strokeWidth="1.5" />
            <rect x="143" y="322" width="34" height="6" rx="2" fill="rgba(255,255,255,0.25)" />
            <text x="160" y="334" textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="800" fill="rgba(255,255,255,0.9)" fontFamily="system-ui" letterSpacing="1">
              PUSH
            </text>
          </g>
        </g>

        {/* ── Label ── */}
        <text x="160" y="70" textAnchor="middle" fontSize="13" fontWeight="800" fill="#FFD700" fontFamily="system-ui" letterSpacing="2">
          CAPSULE TOY
        </text>

        {/* Idle prompt */}
        {phase === 'idle' && members.length > 0 && (
          <text x="160" y="190" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.3)" fontWeight="600" fontFamily="system-ui">
            Push the button!
          </text>
        )}
      </svg>

      {/* ── Winner capsule: rises from the chute and opens ── */}
      {phase === 'done' && winner && (
        <div className="capsule-chute-reveal" style={{ '--capsule-color': winnerColor } as React.CSSProperties}>
          <div className="capsule-chute-ball">
            <div className="capsule-chute-top" />
            <div className="capsule-chute-bottom" />
          </div>
          <div className="capsule-winner-name">{winner}</div>
        </div>
      )}
    </div>
  );
}
