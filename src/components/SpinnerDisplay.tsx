import { useState, useEffect, useRef, useCallback } from 'react';
import { WheelOfFortune } from './WheelOfFortune';
import { AppearDisplay } from './AppearDisplay';
import { ClawMachine } from './ClawMachine';
import { TarotCards } from './TarotCards';
import { Magic8Ball } from './Magic8Ball';
import type { SpinEvent } from '../hooks/useSpinner';

export type Visualization = 'wheel' | 'appear' | 'claw' | 'tarot' | '8ball';

const VIZ_LABELS: Record<Visualization, string> = {
  wheel: 'Wheel',
  appear: 'Appear',
  claw: 'Capsule',
  tarot: 'Tarot',
  '8ball': '8-Ball',
};

/** Visualizations hidden from the UI (still functional, just not selectable) */
const HIDDEN_VIZ: Set<Visualization> = new Set(['8ball']);

const SUBTITLES = [
  'Evenly distributing discomfort since 2026.',
  'Because someone has to do it.',
  'Turning volunteers into voluntolds.',
  'Fairness through chaos.',
  'No one is safe.',
  'Democracy was never this stressful.',
  'Where every spin is someone else\'s problem.',
  'Accountability, but make it random.',
  'The universe decides. You just watch.',
  'Suffering, now with equal opportunity.',
  'You can\'t hide from the wheel.',
  'Today\'s volunteer has already been chosen. They just don\'t know yet.',
  'Rotating responsibility until morale improves.',
  'The wheel remembers. The wheel always remembers.',
  'Hope is the thing with feathers. This is not that.',
  'Fortune favours the bold. This favours no one.',
  'All roads lead to your name on the wheel.',
  'Resistance is futile. The spinner has spoken.',
  'Not a popularity contest. More of a lottery of doom.',
  'May the odds be never in your favour.',
];

interface Props {
  members: string[];
  onSpin: () => string | null;
  onSkip: () => string | null;
  onConfirm: (name: string) => void;
  onBroadcastSpin: (event: Omit<SpinEvent, 'tabId' | 'timestamp'>) => void;
  remoteSpinEvent: SpinEvent | null;
  onClearRemoteSpin: () => void;
}

type Phase = 'idle' | 'spinning' | 'done';

export function SpinnerDisplay({ members, onSpin, onSkip, onConfirm, onBroadcastSpin, remoteSpinEvent, onClearRemoteSpin }: Props) {
  const [viz, setViz] = useState<Visualization>(() => {
    const saved = localStorage.getItem('spinner-viz');
    if (saved === 'appear' || saved === 'claw' || saved === 'tarot' || saved === '8ball') {
      if (!HIDDEN_VIZ.has(saved)) return saved;
    }
    return 'wheel';
  });
  const [phase, setPhase] = useState<Phase>('idle');
  const [winner, setWinner] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const baseRotation = useRef(0);
  const vizRef = useRef(viz);
  useEffect(() => {
    vizRef.current = viz;
  }, [viz]);

  const switchViz = useCallback((v: Visualization) => {
    setViz(v);
    localStorage.setItem('spinner-viz', v);
    setPhase('idle');
    setWinner(null);
  }, []);

  useEffect(() => () => { timeoutsRef.current.forEach(clearTimeout); }, []);

  function clearTimeouts() {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }

  /** Animate the wheel to a specific target rotation */
  const playSpin = useCallback((targetRotation: number, picked: string, isSkip: boolean) => {
    clearTimeouts();
    setWinner(picked);

    // Absorb any drag offset into the base before spinning
    const currentBase = baseRotation.current + dragOffset;
    baseRotation.current = currentBase;
    setDragOffset(0);
    setIsDragging(false);

    setPhase('spinning');
    setRotation(targetRotation);

    const durations: Record<Visualization, number> = { wheel: 7300, appear: 1000, claw: 7000, tarot: 2500, '8ball': 3000 };
    const duration = durations[vizRef.current] ?? 4000;
    const t0 = setTimeout(() => {
      baseRotation.current = targetRotation;
      setPhase('done');
      if (!isSkip) {
        // Delay confirm for claw viz so the paper reveal isn't spoiled
        const confirmDelay = vizRef.current === 'claw' ? 1800 : 0;
        const t1 = setTimeout(() => onConfirm(picked), confirmDelay);
        timeoutsRef.current.push(t1);
      }
    }, duration);
    timeoutsRef.current.push(t0);
  }, [dragOffset, onConfirm]);

  /** Compute target rotation for a picked winner */
  const computeTarget = useCallback((picked: string, flickVelocity: number): number => {
    const currentBase = baseRotation.current + dragOffset;

    const n = members.length;
    const sliceAngle = 360 / n;
    const winnerIdx = members.indexOf(picked);

    const targetSliceCenter = winnerIdx * sliceAngle + sliceAngle / 2;
    const offsetRange = sliceAngle * 0.35;
    const randomOffset = (Math.random() - 0.5) * 2 * offsetRange;

    const velocitySpins = Math.min(Math.abs(flickVelocity) / 120, 5);
    const fullSpins = 360 * (4 + Math.floor(velocitySpins) + Math.floor(Math.random() * 2));

    const direction = flickVelocity >= 0 ? 1 : -1;

    const landingAngle = ((360 - targetSliceCenter + randomOffset) % 360 + 360) % 360;
    const currentMod = ((currentBase % 360) + 360) % 360;
    let neededDelta = landingAngle - currentMod;

    if (direction >= 0) {
      if (neededDelta < 0) neededDelta += 360;
    } else {
      if (neededDelta > 0) neededDelta -= 360;
    }

    return currentBase + direction * fullSpins + neededDelta;
  }, [members, dragOffset]);

  /** Launch the spin animation to land on a picked winner */
  const launchSpin = useCallback((picker: () => string | null, flickVelocity: number, isSkip: boolean) => {
    if (members.length === 0) return;

    const picked = picker();
    if (!picked) return;

    const targetRotation = computeTarget(picked, flickVelocity);
    onBroadcastSpin({ targetRotation, winner: picked, isSkip });
    playSpin(targetRotation, picked, isSkip);
  }, [members, computeTarget, playSpin, onBroadcastSpin]);

  // Listen for remote spin events
  useEffect(() => {
    if (!remoteSpinEvent) return;
    // Reset our base to 0-normalised so the remote target makes sense
    const currentBase = baseRotation.current + dragOffset;
    // Compute how far we need the wheel to travel to land at the same final angle
    const remoteTarget = remoteSpinEvent.targetRotation;
    const remoteFinalAngle = ((remoteTarget % 360) + 360) % 360;
    const currentMod = ((currentBase % 360) + 360) % 360;
    let delta = remoteFinalAngle - currentMod;
    if (delta < 0) delta += 360;
    // Add several full spins so it looks dramatic
    const localTarget = currentBase + delta + 360 * 5;

    playSpin(localTarget, remoteSpinEvent.winner, remoteSpinEvent.isSkip);
    onClearRemoteSpin();
  }, [remoteSpinEvent, dragOffset, playSpin, onClearRemoteSpin]);

  const spin = useCallback(() => {
    if (phase === 'spinning') return;
    if (phase === 'done') {
      // Re-spin: undo previous pick via onSkip, but confirm the new winner
      launchSpin(onSkip, 300, false);
      return;
    }
    launchSpin(onSpin, 300, false);
  }, [phase, launchSpin, onSpin, onSkip]);

  const tarotSkip = useCallback(() => {
    if (phase === 'spinning') return;
    // Undo the pick
    onSkip();
    // Reset to idle so cards re-deal face-down
    setPhase('idle');
    setWinner(null);
  }, [phase, onSkip]);

  // Drag handlers passed to the wheel
  const handleDragStart = useCallback(() => {
    if (phase === 'spinning') return;
    setIsDragging(true);
    setDragOffset(0);
  }, [phase]);

  const handleDragMove = useCallback((angleDelta: number) => {
    setDragOffset(prev => prev + angleDelta);
  }, []);

  const handleDragEnd = useCallback((velocity: number) => {
    const picker = phase === 'done' ? onSkip : onSpin;
    if (Math.abs(velocity) > 60) {
      launchSpin(picker, velocity, false);
    } else {
      const absOffset = Math.abs(dragOffset);
      baseRotation.current += dragOffset;
      setDragOffset(0);
      setIsDragging(false);

      if (absOffset < 5) {
        launchSpin(picker, 300, false);
      }
      // Otherwise just leave it where the user dragged it
    }
  }, [dragOffset, launchSpin, onSpin]);

  const [subtitle] = useState(() => SUBTITLES[Math.floor(Math.random() * SUBTITLES.length)]);

  return (
    <div className="spinner-section">
      <h1 className="spinner-title">The Load Balancer</h1>
      <p className="spinner-subtitle">"{subtitle}"</p>

      <div className="viz-switcher">
        {(Object.keys(VIZ_LABELS) as Visualization[]).filter(v => !HIDDEN_VIZ.has(v)).map(v => (
          <button
            key={v}
            className={`viz-btn ${v === viz ? 'active' : ''}`}
            onClick={() => switchViz(v)}
          >
            {VIZ_LABELS[v]}
          </button>
        ))}
      </div>

      {viz === 'wheel' && (
        <div className="stage wheel-stage">
          <WheelOfFortune
            members={members}
            rotation={rotation}
            dragOffset={dragOffset}
            isDragging={isDragging}
            phase={phase}
            winner={winner}
            onSpin={spin}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
          />
        </div>
      )}

      {viz === 'appear' && (
        <div className="stage appear-stage">
          <AppearDisplay
            members={members}
            phase={phase}
            winner={winner}
            onTrigger={spin}
          />
        </div>
      )}

      {viz === 'claw' && (
        <div className="stage claw-stage">
          <ClawMachine
            members={members}
            phase={phase}
            winner={winner}
            onTrigger={spin}
          />
        </div>
      )}

      {viz === 'tarot' && (
        <div className="stage tarot-stage">
          <TarotCards
            members={members}
            phase={phase}
            winner={winner}
            onTrigger={spin}
            onSkip={tarotSkip}
          />
        </div>
      )}

      {viz === '8ball' && (
        <div className="stage magic8-stage">
          <Magic8Ball
            members={members}
            phase={phase}
            winner={winner}
            onTrigger={spin}
          />
        </div>
      )}

      {members.length === 0 && (
        <p className="hint">Add some team members to get started.</p>
      )}
    </div>
  );
}
