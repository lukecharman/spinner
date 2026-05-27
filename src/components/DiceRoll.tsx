import { useEffect, useState, useRef, useCallback } from 'react';

type Phase = 'idle' | 'spinning' | 'done';

interface Props {
  members: string[];
  phase: Phase;
  winner: string | null;
  onTrigger: () => void;
}

/* Which face index (1-6) shows on top for each named orientation */
const FACE_ROTATIONS: Record<number, { rx: number; ry: number }> = {
  1: { rx: 0, ry: 0 },
  2: { rx: -90, ry: 0 },
  3: { rx: 0, ry: 90 },
  4: { rx: 0, ry: -90 },
  5: { rx: 90, ry: 0 },
  6: { rx: 180, ry: 0 },
};

const DICE_SIZE = 150; // visual size in px (matches CSS clamp midpoint)
const GRAVITY = 1200;  // px/s²
const RESTITUTION = 0.55;
const FRICTION = 0.97;
const SPIN_DAMPING = 0.985;

interface PhysState {
  x: number; y: number;
  vx: number; vy: number;
  rx: number; ry: number;   // cumulative rotation degrees
  vrx: number; vry: number; // rotation speed deg/s
}

export function DiceRoll({ members, phase, winner, onTrigger }: Props) {
  const arenaRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const stateRef = useRef<PhysState>({ x: 0, y: 0, vx: 0, vy: 0, rx: -20, ry: 30, vrx: 0, vry: 0 });
  const [pos, setPos] = useState<{ x: number; y: number; rx: number; ry: number }>({ x: 0, y: 0, rx: -20, ry: 30 });
  const settledRef = useRef(false);
  const scrambleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [scrambleName, setScrambleName] = useState<string | null>(null);

  const faces = Array.from({ length: 6 }, (_, i) =>
    members.length > 0 ? members[i % members.length] : ''
  );

  const winnerFaceIdx = winner
    ? (faces.indexOf(winner) !== -1 ? faces.indexOf(winner) + 1 : 1)
    : 1;

  const getArenaSize = useCallback(() => {
    const el = arenaRef.current;
    if (!el) return { w: 500, h: 400 };
    return { w: el.clientWidth, h: el.clientHeight };
  }, []);

  /* Physics loop */
  const simulate = useCallback((prevTime: number) => {
    rafRef.current = requestAnimationFrame((now) => {
      const dt = Math.min((now - prevTime) / 1000, 0.05); // cap at 50ms
      const s = stateRef.current;
      const { w, h } = getArenaSize();
      const half = DICE_SIZE / 2;

      // Apply gravity
      s.vy += GRAVITY * dt;

      // Update position
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // Update rotation
      s.rx += s.vrx * dt;
      s.ry += s.vry * dt;

      // Dampen spin
      s.vrx *= SPIN_DAMPING;
      s.vry *= SPIN_DAMPING;

      // Bounce off floor
      const maxY = h - half;
      if (s.y > maxY) {
        s.y = maxY;
        s.vy = -Math.abs(s.vy) * RESTITUTION;
        s.vx *= FRICTION;
        // Add spin from floor contact
        s.vry += s.vx * 0.5;
      }

      // Bounce off ceiling
      if (s.y < 0) {
        s.y = 0;
        s.vy = Math.abs(s.vy) * RESTITUTION;
      }

      // Bounce off walls
      const maxX = w / 2 - half;
      const minX = -(w / 2 - half);
      if (s.x > maxX) {
        s.x = maxX;
        s.vx = -Math.abs(s.vx) * RESTITUTION;
        s.vrx += s.vy * 0.3;
      }
      if (s.x < minX) {
        s.x = minX;
        s.vx = Math.abs(s.vx) * RESTITUTION;
        s.vrx -= s.vy * 0.3;
      }

      // Friction when near floor
      if (s.y >= maxY - 2) {
        s.vx *= 0.98;
      }

      setPos({ x: s.x, y: s.y, rx: s.rx, ry: s.ry });

      // Check if settled (near floor, low velocity)
      const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
      const spinSpeed = Math.abs(s.vrx) + Math.abs(s.vry);
      if (s.y >= maxY - 3 && speed < 15 && spinSpeed < 30) {
        settledRef.current = true;
        return; // stop sim
      }

      simulate(now);
    });
  }, [getArenaSize]);

  useEffect(() => {
    if (phase === 'spinning') {
      settledRef.current = false;

      scrambleRef.current = setInterval(() => {
        setScrambleName(members[Math.floor(Math.random() * members.length)] ?? null);
      }, 80);

      const { w, h } = getArenaSize();
      const half = DICE_SIZE / 2;

      // Start from bottom center, throw upward and to a random side
      const dirX = Math.random() > 0.5 ? 1 : -1;
      stateRef.current = {
        x: dirX * (w * 0.1),
        y: h - half,
        vx: dirX * (300 + Math.random() * 400),
        vy: -(700 + Math.random() * 500),
        rx: 0, ry: 0,
        vrx: (400 + Math.random() * 600) * dirX,
        vry: (300 + Math.random() * 500) * -dirX,
      };

      setPos({ x: stateRef.current.x, y: stateRef.current.y, rx: 0, ry: 0 });
      simulate(performance.now());

      return () => {
        cancelAnimationFrame(rafRef.current);
        if (scrambleRef.current) clearInterval(scrambleRef.current);
      };
    }

    if (phase === 'done') {
      cancelAnimationFrame(rafRef.current);
      if (scrambleRef.current) clearInterval(scrambleRef.current);
      setScrambleName(null);
      // Keep current position, snap rotation to winner face
      const landing = FACE_ROTATIONS[winnerFaceIdx];
      setPos(p => ({ ...p, rx: landing.rx, ry: landing.ry }));
    }

    if (phase === 'idle') {
      cancelAnimationFrame(rafRef.current);
      if (scrambleRef.current) clearInterval(scrambleRef.current);
      setScrambleName(null);
      settledRef.current = false;
      setPos({ x: 0, y: 0, rx: -20, ry: 30 });
    }
  }, [phase]);

  const isIdle = phase === 'idle';
  const isDone = phase === 'done';

  const sceneStyle: React.CSSProperties = isIdle
    ? { transform: 'translate(-50%, -50%)', left: '50%', top: '50%' }
    : { transform: `translate(calc(-50% + ${pos.x}px), ${pos.y}px)`, left: '50%', top: '0' };

  const cubeStyle: React.CSSProperties = isDone
    ? {
        transform: `rotateX(${pos.rx}deg) rotateY(${pos.ry}deg)`,
        transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }
    : {
        transform: `rotateX(${pos.rx}deg) rotateY(${pos.ry}deg)`,
        transition: 'none',
      };

  return (
    <div className="dice-display" onClick={phase !== 'spinning' ? onTrigger : undefined}>
      <div className="dice-arena" ref={arenaRef}>
        <div className="dice-scene" style={sceneStyle}>
          <div className="dice-cube" style={cubeStyle}>
            {faces.map((name, i) => (
              <div key={i} className={`dice-face dice-face-${i + 1}`}>
                <span className="dice-face-text">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {phase === 'spinning' && scrambleName && (
        <div className="dice-scramble">{scrambleName}</div>
      )}

      {phase === 'done' && winner && (
        <div className="dice-result">{winner}</div>
      )}

      {phase === 'idle' && (
        <div className="dice-prompt">
          {members.length > 0 ? 'Tap to roll' : 'Add members to start'}
        </div>
      )}
    </div>
  );
}
