import { useEffect, useState, useRef, useCallback } from 'react';

type Phase = 'idle' | 'spinning' | 'done';

interface Props {
  members: string[];
  phase: Phase;
  winner: string | null;
  onTrigger: () => void;
}

export function Magic8Ball({ members, phase, winner, onTrigger }: Props) {
  const [floatingNames, setFloatingNames] = useState<
    { name: string; x: number; y: number; blur: number; opacity: number; scale: number }[]
  >([]);
  const rafRef = useRef(0);
  const namesRef = useRef<
    { name: string; x: number; y: number; vx: number; vy: number; blur: number; opacity: number; scale: number }[]
  >([]);
  const phaseRef = useRef(phase);
  const winnerRef = useRef(winner);
  useEffect(() => {
    phaseRef.current = phase;
    winnerRef.current = winner;
  }, [phase, winner]);

  // ── Ball physics state ──
  const [ballPos, setBallPos] = useState({ x: 0, y: 0 });
  const [ballRot, setBallRot] = useState(0);
  const ballPosRef = useRef({ x: 0, y: 0 });
  const bounceRaf = useRef(0);
  const ballRef = useRef<HTMLDivElement>(null);

  // Scramble names floating in the window during spin
  const startScramble = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const pool = members.length > 0 ? members : ['?'];
    // Pick up to 6 names to float around (duplicates OK if few members)
    const count = Math.min(pool.length * 2, 8);
    namesRef.current = Array.from({ length: count }, (_, i) => ({
      name: pool[i % pool.length],
      x: (Math.random() - 0.5) * 100,
      y: (Math.random() - 0.5) * 60,
      vx: (Math.random() - 0.5) * 120,
      vy: (Math.random() - 0.5) * 80,
      blur: 1 + Math.random() * 2,
      opacity: 0.3 + Math.random() * 0.4,
      scale: 0.6 + Math.random() * 0.4,
    }));

    let lastTime = performance.now();
    let elapsed = 0;

    function step(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.03);
      lastTime = now;
      elapsed += dt;

      const p = phaseRef.current;
      const w = winnerRef.current;

      for (const n of namesRef.current) {
        if (p === 'done' && w) {
          // Settle: winner surfaces to center, others drift away
          if (n.name === w) {
            // Strong spring pull toward center
            n.vx += (0 - n.x) * 12 * dt;
            n.vy += (0 - n.y) * 12 * dt;
            n.vx *= 0.92;
            n.vy *= 0.92;
            n.x += n.vx * dt;
            n.y += n.vy * dt;
            n.blur = Math.max(0, n.blur - 8 * dt);
            n.opacity = Math.min(1, n.opacity + 3 * dt);
            n.scale = Math.min(1.2, n.scale + 1.0 * dt);
          } else {
            // Fade out quickly
            n.opacity = Math.max(0, n.opacity - 2.5 * dt);
            n.blur = Math.min(12, n.blur + 10 * dt);
          }
        } else {
          // Bounce around inside the window
          n.x += n.vx * dt;
          n.y += n.vy * dt;

          // Occasional random impulses
          if (Math.random() < 0.02) {
            n.vx += (Math.random() - 0.5) * 80;
            n.vy += (Math.random() - 0.5) * 60;
          }

          // Damping
          n.vx *= 0.97;
          n.vy *= 0.97;

          // Bounce off edges of the triangular window area
          if (Math.abs(n.x) > 55) { n.vx *= -0.8; n.x = Math.sign(n.x) * 55; }
          if (Math.abs(n.y) > 35) { n.vy *= -0.8; n.y = Math.sign(n.y) * 35; }

          // Vary blur
          n.blur = 1 + Math.sin(elapsed * 2 + n.x * 0.1) * 1;
          n.opacity = 0.25 + Math.sin(elapsed * 1.5 + n.y * 0.1) * 0.15 + 0.2;
        }
      }

      setFloatingNames(namesRef.current.map(n => ({
        name: n.name,
        x: n.x,
        y: n.y,
        blur: n.blur,
        opacity: n.opacity,
        scale: n.scale,
      })));

      // Stop once done and settled
      if (p === 'done') {
        const winnerEntry = namesRef.current.find(n => n.name === w);
        if (winnerEntry && winnerEntry.blur < 0.1 && Math.abs(winnerEntry.x) < 2 && Math.abs(winnerEntry.y) < 2) {
          return;
        }
      }

      rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);
  }, [members]);

  useEffect(() => {
    if (phase === 'spinning') {
      startScramble();
    }
    // Don't cancel on cleanup — let the animation continue into 'done' phase
  }, [phase, startScramble]);

  // Cancel animation when returning to idle (floating names are hidden while idle)
  useEffect(() => {
    if (phase === 'idle') {
      cancelAnimationFrame(rafRef.current);
      namesRef.current = [];
    }
  }, [phase]);

  const canTap = phase !== 'spinning' && members.length > 0;

  // Launch ball in a random direction, bouncing off walls
  const shake = useCallback(() => {
    if (!canTap) return;

    // Random direction with strong velocity
    const angle = Math.random() * Math.PI * 2;
    const speed = 600 + Math.random() * 400;
    let vx = Math.cos(angle) * speed;
    let vy = Math.sin(angle) * speed;
    let px = ballPosRef.current.x;
    let py = ballPosRef.current.y;
    let lastTime = performance.now();

    const GRAVITY = 400;
    const FRICTION = 0.992;
    const WALL_BOUNCE = 0.55;

    cancelAnimationFrame(bounceRaf.current);

    function step(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.03);
      lastTime = now;

      const el = ballRef.current;
      if (!el) return;
      const ballRect = el.getBoundingClientRect();
      const ballW = ballRect.width / 2;
      const ballH = ballRect.height / 2;
      const centerX = ballRect.left + ballW - px;
      const centerY = ballRect.top + ballH - py;
      const minX = -(centerX - ballW);
      const maxX = window.innerWidth - centerX - ballW;
      const minY = -(centerY - ballH);
      const maxY = window.innerHeight - centerY - ballH;

      vy += GRAVITY * dt;
      vx *= FRICTION;
      vy *= FRICTION;
      px += vx * dt;
      py += vy * dt;

      if (px < minX) { px = minX; vx = Math.abs(vx) * WALL_BOUNCE; }
      if (px > maxX) { px = maxX; vx = -Math.abs(vx) * WALL_BOUNCE; }
      if (py < minY) { py = minY; vy = Math.abs(vy) * WALL_BOUNCE; }
      if (py > maxY) { py = maxY; vy = -Math.abs(vy) * WALL_BOUNCE; }

      const rot = px * 0.08;
      ballPosRef.current = { x: px, y: py };
      setBallPos({ x: px, y: py });
      setBallRot(rot);

      const spd = Math.sqrt(vx * vx + vy * vy);
      if (spd < 15) return;

      bounceRaf.current = requestAnimationFrame(step);
    }

    bounceRaf.current = requestAnimationFrame(step);
    onTrigger();
  }, [canTap, onTrigger]);

  // Cleanup bounce animation on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(bounceRaf.current);
  }, []);

  return (
    <div className="magic8-display">
      <div
        ref={ballRef}
        className="magic8-mover"
        style={{
          transform: `translate(${ballPos.x}px, ${ballPos.y}px) rotate(${ballRot}deg)`,
        }}
      >
        <div className={`magic8-ball ${phase === 'spinning' ? 'magic8-wobble' : ''}`}>
          {/* Outer ball shine */}
          <div className="magic8-shine" />

          {/* The 8 circle on top */}
          <div className="magic8-number">
            <span>8</span>
          </div>

          {/* Viewing window */}
          <div className="magic8-window">
            <div className="magic8-fluid">
              {phase === 'idle' && members.length > 0 && (
                <div className="magic8-idle-text">Ask&hellip;</div>
              )}
              {phase === 'idle' && members.length === 0 && (
                <div className="magic8-idle-text">Add members</div>
              )}
              {(phase === 'spinning' || phase === 'done') && floatingNames.map((n, i) => (
                <div
                  key={i}
                  className="magic8-floating-name"
                  style={{
                    transform: `translate(calc(-50% + ${n.x}px), calc(-50% + ${n.y}px)) scale(${n.scale})`,
                    filter: `blur(${n.blur}px)`,
                    opacity: n.opacity,
                  }}
                >
                  {n.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {canTap && (
        <button className="magic8-shake-btn" onClick={shake}>
          🎱 Shake
        </button>
      )}
    </div>
  );
}
