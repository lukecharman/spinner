import { useState, useEffect, useRef } from 'react';

interface Props {
  members: string[];
  /** Called when the animation completes; receives the winner */
  onSpin: () => string | null;
}

/**
 * Generates an animation sequence: cycle through all members multiple times
 * (fast), then slow down and land on the winner.
 */
function buildSequence(members: string[], winner: string): string[] {
  if (members.length === 0) return [winner];
  const seq: string[] = [];

  // Fast phase: shuffle through all members 3 times
  for (let i = 0; i < 3; i++) {
    const shuffled = [...members].sort(() => Math.random() - 0.5);
    seq.push(...shuffled);
  }

  // Slow-down phase: a few more random picks (excluding winner)
  const others = members.filter(m => m !== winner);
  const slowPhase = others.length > 0
    ? [...others].sort(() => Math.random() - 0.5).slice(0, Math.min(6, others.length))
    : [];
  seq.push(...slowPhase);

  // Always end on the winner
  seq.push(winner);
  return seq;
}

/**
 * Generates cumulative delays (ms) for each frame in the sequence.
 * Starts fast (~60ms/frame) and slows to ~550ms for the final frames.
 */
function buildDelays(sequenceLength: number): number[] {
  const delays: number[] = [];
  const slowFrames = Math.min(8, sequenceLength);
  const fastFrames = sequenceLength - slowFrames;

  for (let i = 0; i < fastFrames; i++) {
    delays.push(60);
  }
  // Exponentially increasing delays for the slow-down phase
  for (let i = 0; i < slowFrames; i++) {
    delays.push(Math.round(80 * Math.pow(1.55, i)));
  }
  return delays;
}

export function SpinnerDisplay({ members, onSpin }: Props) {
  const [displayName, setDisplayName] = useState<string>('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Clear pending timeouts on unmount
  useEffect(() => () => { timeoutsRef.current.forEach(clearTimeout); }, []);

  function spin() {
    if (isSpinning || members.length === 0) return;

    // Determine the winner before starting animation
    const picked = onSpin();
    if (!picked) return;

    setWinner(null);
    setFlash(false);
    setIsSpinning(true);
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    const sequence = buildSequence(members, picked);
    const delayMs = buildDelays(sequence.length);

    let accumulated = 0;
    sequence.forEach((name, idx) => {
      accumulated += delayMs[idx];
      const isLast = idx === sequence.length - 1;
      const t = setTimeout(() => {
        setDisplayName(name);
        if (isLast) {
          setIsSpinning(false);
          setWinner(name);
          setFlash(true);
          setTimeout(() => setFlash(false), 600);
        }
      }, accumulated);
      timeoutsRef.current.push(t);
    });
  }

  const canSpin = members.length > 0 && !isSpinning;

  return (
    <div className="spinner-section">
      <div className={`name-display ${isSpinning ? 'spinning' : ''} ${flash ? 'flash' : ''}`}>
        {displayName
          ? <span className="name-text">{displayName}</span>
          : <span className="name-placeholder">Press Spin!</span>
        }
      </div>

      {winner && !isSpinning && (
        <p className="winner-label">🎉 {winner} is hosting today!</p>
      )}

      <button
        className="spin-btn"
        onClick={spin}
        disabled={!canSpin}
        aria-label="Spin to pick the next standup host"
      >
        {isSpinning ? 'Spinning…' : 'Spin!'}
      </button>

      {members.length === 0 && (
        <p className="hint">Add some team members to get started.</p>
      )}
    </div>
  );
}
