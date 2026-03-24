import { useState, useEffect, useRef, useCallback } from 'react';
import { WheelOfFortune } from './WheelOfFortune';
import { AppearDisplay } from './AppearDisplay';
import { ClawMachine } from './ClawMachine';
import { TarotCards } from './TarotCards';
import type { SpinEvent } from '../hooks/useSpinner';

export type Visualization = 'wheel' | 'appear' | 'claw' | 'tarot';

const VIZ_LABELS: Record<Visualization, string> = {
  wheel: 'Wheel',
  appear: 'Appear',
  claw: 'Capsule',
  tarot: 'Tarot',
};

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
    if (saved === 'appear' || saved === 'claw' || saved === 'tarot') return saved;
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
  vizRef.current = viz;

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

    const durations: Record<Visualization, number> = { wheel: 7300, appear: 1000, claw: 3500, tarot: 2500 };
    const duration = durations[vizRef.current] ?? 4000;
    const t0 = setTimeout(() => {
      baseRotation.current = targetRotation;
      setPhase('done');
      if (!isSkip) {
        onConfirm(picked);
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
    launchSpin(onSpin, 300, false);
  }, [phase, launchSpin, onSpin]);

  const skip = useCallback(() => {
    if (phase === 'spinning') return;
    launchSpin(onSkip, 300, true);
  }, [phase, launchSpin, onSkip]);

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
    if (Math.abs(velocity) > 60) {
      // Flick! Launch the spin with the measured velocity
      launchSpin(onSpin, velocity, false);
    } else {
      // Tap or gentle release — just do a normal spin if offset is tiny
      const absOffset = Math.abs(dragOffset);
      // Absorb the drag offset
      baseRotation.current += dragOffset;
      setDragOffset(0);
      setIsDragging(false);

      if (absOffset < 5) {
        // Tap — spin
        launchSpin(onSpin, 300, false);
      }
      // Otherwise just leave it where the user dragged it
    }
  }, [dragOffset, launchSpin, onSpin]);

  const canSpin = members.length > 0 && phase !== 'spinning';

  return (
    <div className="spinner-section">
      <h1 className="spinner-title">The Load Balancer</h1>
      <p className="spinner-subtitle">"Evenly distributing discomfort since 2026."</p>

      <div className="viz-switcher">
        {(Object.keys(VIZ_LABELS) as Visualization[]).map(v => (
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

      {viz !== 'claw' && viz !== 'tarot' && (
        <div className="button-row">
          <button
            className="spin-btn"
            onClick={spin}
            disabled={!canSpin}
          >
            {phase === 'spinning' ? 'Spinning…' : 'Spin!'}
          </button>

          {phase === 'done' && winner && (
            <button
              className="skip-btn"
              onClick={skip}
            >
              Skip – re-spin
            </button>
          )}
        </div>
      )}

      {members.length === 0 && (
        <p className="hint">Add some team members to get started.</p>
      )}
    </div>
  );
}
