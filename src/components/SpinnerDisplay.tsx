import { useState, useEffect, useRef, useCallback } from 'react';
import { WheelOfFortune } from './WheelOfFortune';

interface Props {
  members: string[];
  onSpin: () => string | null;
  onSkip: () => string | null;
  onConfirm: (name: string) => void;
}

type Phase = 'idle' | 'spinning' | 'done';

export function SpinnerDisplay({ members, onSpin, onSkip, onConfirm }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [winner, setWinner] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const baseRotation = useRef(0);

  useEffect(() => () => { timeoutsRef.current.forEach(clearTimeout); }, []);

  function clearTimeouts() {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }

  /** Launch the spin animation to land on a picked winner */
  const launchSpin = useCallback((picker: () => string | null, flickVelocity: number) => {
    if (members.length === 0) return;

    const picked = picker();
    if (!picked) return;

    clearTimeouts();
    setWinner(null);

    // Absorb any drag offset into the base before spinning
    const currentBase = baseRotation.current + dragOffset;
    baseRotation.current = currentBase;
    setDragOffset(0);
    setIsDragging(false);

    setPhase('spinning');

    const n = members.length;
    const sliceAngle = 360 / n;
    const winnerIdx = members.indexOf(picked);

    const targetSliceCenter = winnerIdx * sliceAngle + sliceAngle / 2;
    const offsetRange = sliceAngle * 0.35;
    const randomOffset = (Math.random() - 0.5) * 2 * offsetRange;

    // Scale extra spins based on flick velocity
    // Minimum 4 full spins, velocity adds more
    const velocitySpins = Math.min(Math.abs(flickVelocity) / 120, 5);
    const fullSpins = 360 * (4 + Math.floor(velocitySpins) + Math.floor(Math.random() * 2));

    // Determine spin direction from flick (if velocity is meaningful)
    // Positive velocity = clockwise drag → spin clockwise
    const direction = flickVelocity >= 0 ? 1 : -1;

    // Calculate target: we need (currentBase + totalSpin) mod 360 = (360 - targetSliceCenter + randomOffset) mod 360
    const landingAngle = ((360 - targetSliceCenter + randomOffset) % 360 + 360) % 360;
    const currentMod = ((currentBase % 360) + 360) % 360;
    let neededDelta = landingAngle - currentMod;

    // Adjust delta to match the flick direction
    if (direction >= 0) {
      if (neededDelta < 0) neededDelta += 360;
    } else {
      if (neededDelta > 0) neededDelta -= 360;
    }

    const targetRotation = currentBase + direction * fullSpins + neededDelta;

    setRotation(targetRotation);

    const shouldConfirm = picker === onSpin;
    const t0 = setTimeout(() => {
      baseRotation.current = targetRotation;
      setPhase('done');
      setWinner(picked);
      if (shouldConfirm) {
        onConfirm(picked);
      }
    }, 7300);
    timeoutsRef.current.push(t0);
  }, [members, dragOffset, onSpin, onConfirm]);

  const spin = useCallback(() => {
    if (phase === 'spinning') return;
    launchSpin(onSpin, 300);
  }, [phase, launchSpin, onSpin]);

  const skip = useCallback(() => {
    if (phase === 'spinning') return;
    launchSpin(onSkip, 300);
  }, [phase, launchSpin, onSkip]);

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
      launchSpin(onSpin, velocity);
    } else {
      // Tap or gentle release — just do a normal spin if offset is tiny
      const absOffset = Math.abs(dragOffset);
      // Absorb the drag offset
      baseRotation.current += dragOffset;
      setDragOffset(0);
      setIsDragging(false);

      if (absOffset < 5) {
        // Tap — spin
        launchSpin(onSpin, 300);
      }
      // Otherwise just leave it where the user dragged it
    }
  }, [dragOffset, launchSpin, onSpin]);

  const canSpin = members.length > 0 && phase !== 'spinning';

  return (
    <div className="spinner-section">
      <h1 className="spinner-title">Standup Spinner</h1>
      <p className="spinner-subtitle">Who's hosting today?</p>

      <div className="stage wheel-stage">
        <WheelOfFortune
          size={560}
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

      {members.length === 0 && (
        <p className="hint">Add some team members to get started.</p>
      )}
    </div>
  );
}
