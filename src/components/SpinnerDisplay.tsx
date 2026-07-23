import { useState, useEffect, useRef, useCallback } from 'react';
import { WheelOfFortune } from './WheelOfFortune';
import { AppearDisplay } from './AppearDisplay';
import { ClawMachine } from './ClawMachine';
import { TarotCards } from './TarotCards';
import { Magic8Ball } from './Magic8Ball';
import { VaultDisplay } from './VaultDisplay';
import { AlgorithmDisplay } from './AlgorithmDisplay';
import type { SpinEvent } from '../hooks/useSpinner';
import type { SpinSelection } from '../hooks/spinnerState';

export type Visualization = 'wheel' | 'appear' | 'algorithm' | 'claw' | 'vault' | 'tarot' | '8ball';

const VIZ_LABELS: Record<Visualization, string> = {
  wheel: 'Wheel',
  appear: 'Appear',
  algorithm: 'Algorithm',
  claw: 'Capsule',
  vault: 'Vault',
  tarot: 'Tarot',
  '8ball': '8-Ball',
};

/** Visualizations hidden from the UI (still functional, just not selectable) */
const HIDDEN_VIZ: Set<Visualization> = new Set(['8ball']);
const VISIBLE_VISUALIZATIONS = (Object.keys(VIZ_LABELS) as Visualization[])
  .filter(visualization => !HIDDEN_VIZ.has(visualization));

function loadVisualization(): Visualization {
  try {
    const saved = localStorage.getItem('spinner-viz');
    if (
      (saved === 'wheel' || saved === 'appear' || saved === 'algorithm' || saved === 'claw' || saved === 'vault' || saved === 'tarot' || saved === '8ball')
      && !HIDDEN_VIZ.has(saved)
    ) {
      return saved;
    }
  } catch (error) {
    console.warn('Unable to read the saved visualization.', error);
  }
  return 'wheel';
}

function saveVisualization(visualization: Visualization): void {
  try {
    localStorage.setItem('spinner-viz', visualization);
  } catch (error) {
    console.warn('Unable to save the selected visualization.', error);
  }
}

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
  activePickId: string | null;
  onSpin: () => Promise<SpinSelection | null>;
  onRespin: (selection: SpinSelection) => Promise<SpinSelection | null>;
  onUndo: (selection: SpinSelection) => Promise<boolean>;
  onBroadcastSpin: (event: Omit<SpinEvent, 'tabId' | 'timestamp'>) => void;
  remoteSpinEvent: SpinEvent | null;
  onClearRemoteSpin: () => void;
}

type Phase = 'idle' | 'spinning' | 'done';

export function SpinnerDisplay({ members, activePickId, onSpin, onRespin, onUndo, onBroadcastSpin, remoteSpinEvent, onClearRemoteSpin }: Props) {
  const [viz, setViz] = useState<Visualization>(loadVisualization);
  const [phase, setPhase] = useState<Phase>('idle');
  const [selection, setSelection] = useState<SpinSelection | null>(null);
  const [rotation, setRotation] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startingRef = useRef(false);
  const baseRotation = useRef(0);
  const vizRef = useRef(viz);
  const selectionIsCurrent = !selection || selection.pickId === activePickId;
  const displayedPhase = selectionIsCurrent ? phase : 'idle';
  const winner = selectionIsCurrent ? selection?.winner ?? null : null;
  useEffect(() => {
    vizRef.current = viz;
  }, [viz]);

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const switchViz = useCallback((v: Visualization) => {
    if (displayedPhase === 'spinning') return;
    clearTimeouts();
    setViz(v);
    saveVisualization(v);
    setPhase('idle');
    setSelection(null);
  }, [clearTimeouts, displayedPhase]);

  const randomizeViz = useCallback(() => {
    const alternatives = VISIBLE_VISUALIZATIONS.filter(visualization => visualization !== viz);
    const next = alternatives[Math.floor(Math.random() * alternatives.length)];
    if (next) switchViz(next);
  }, [switchViz, viz]);

  useEffect(() => () => { timeoutsRef.current.forEach(clearTimeout); }, []);

  /** Animate the wheel to a specific target rotation */
  const playSpin = useCallback((targetRotation: number, picked: SpinSelection) => {
    clearTimeouts();
    setSelection(picked);

    // Absorb any drag offset into the base before spinning
    const currentBase = baseRotation.current + dragOffset;
    baseRotation.current = currentBase;
    setDragOffset(0);
    setIsDragging(false);

    setPhase('spinning');
    setRotation(targetRotation);

    const durations: Record<Visualization, number> = {
      wheel: 7300,
      appear: 1000,
      algorithm: 4600,
      claw: 7000,
      vault: 5700,
      tarot: 2500,
      '8ball': 3000,
    };
    const duration = durations[vizRef.current] ?? 4000;
    const t0 = setTimeout(() => {
      baseRotation.current = targetRotation;
      setPhase('done');
    }, duration);
    timeoutsRef.current.push(t0);
  }, [clearTimeouts, dragOffset]);

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
  const launchSpin = useCallback(async (
    picker: () => Promise<SpinSelection | null>,
    flickVelocity: number,
  ) => {
    if (members.length === 0 || startingRef.current) return;

    startingRef.current = true;
    const previousPhase = displayedPhase;
    setPhase('spinning');

    try {
      const picked = await picker();
      if (!picked) {
        setPhase(previousPhase);
        return;
      }

      const targetRotation = computeTarget(picked.winner, flickVelocity);
      onBroadcastSpin({ targetRotation, ...picked });
      playSpin(targetRotation, picked);
    } finally {
      startingRef.current = false;
    }
  }, [members, displayedPhase, computeTarget, playSpin, onBroadcastSpin]);

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

    playSpin(localTarget, {
      winner: remoteSpinEvent.winner,
      pickId: remoteSpinEvent.pickId,
    });
    onClearRemoteSpin();
  }, [remoteSpinEvent, dragOffset, playSpin, onClearRemoteSpin]);

  const spin = useCallback(() => {
    if (displayedPhase === 'spinning') return;
    if (displayedPhase === 'done' && selection) {
      void launchSpin(() => onRespin(selection), 300);
      return;
    }
    void launchSpin(onSpin, 300);
  }, [displayedPhase, selection, launchSpin, onSpin, onRespin]);

  const tarotSkip = useCallback(() => {
    if (displayedPhase === 'spinning' || !selection || startingRef.current) return;
    void onUndo(selection);
    setPhase('idle');
    setSelection(null);
  }, [displayedPhase, selection, onUndo]);

  // Drag handlers passed to the wheel
  const handleDragStart = useCallback(() => {
    if (displayedPhase === 'spinning') return;
    setIsDragging(true);
    setDragOffset(0);
  }, [displayedPhase]);

  const handleDragMove = useCallback((angleDelta: number) => {
    setDragOffset(prev => prev + angleDelta);
  }, []);

  const handleDragEnd = useCallback((velocity: number) => {
    const picker = displayedPhase === 'done' && selection
      ? () => onRespin(selection)
      : onSpin;
    if (Math.abs(velocity) > 60) {
      void launchSpin(picker, velocity);
    } else {
      const absOffset = Math.abs(dragOffset);

      if (absOffset < 5) {
        setIsDragging(false);
        void launchSpin(picker, 300);
        return;
      }

      const settledRotation = baseRotation.current + dragOffset;
      baseRotation.current = settledRotation;
      setRotation(settledRotation);
      setDragOffset(0);
      setIsDragging(false);
    }
  }, [displayedPhase, selection, dragOffset, launchSpin, onSpin, onRespin]);

  const [subtitle] = useState(() => SUBTITLES[Math.floor(Math.random() * SUBTITLES.length)]);

  return (
    <div className="spinner-section">
      <h1 className="spinner-title">The Load Balancer</h1>
      <p className="spinner-subtitle">"{subtitle}"</p>

      <div className="viz-switcher">
        <button
          className="viz-btn"
          onClick={randomizeViz}
          disabled={displayedPhase === 'spinning'}
          aria-label="Pick a random visualization"
          title="Pick a random visualization"
        >
          🎲 Random
        </button>
        {VISIBLE_VISUALIZATIONS.map(v => (
          <button
            key={v}
            className={`viz-btn ${v === viz ? 'active' : ''}`}
            onClick={() => switchViz(v)}
            disabled={displayedPhase === 'spinning'}
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
            phase={displayedPhase}
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
            phase={displayedPhase}
            winner={winner}
            onTrigger={spin}
          />
        </div>
      )}

      {viz === 'algorithm' && (
        <div className="stage algorithm-stage">
          <AlgorithmDisplay
            members={members}
            phase={displayedPhase}
            winner={winner}
            onTrigger={spin}
          />
        </div>
      )}

      {viz === 'claw' && (
        <div className="stage claw-stage">
          <ClawMachine
            members={members}
            phase={displayedPhase}
            winner={winner}
            onTrigger={spin}
          />
        </div>
      )}

      {viz === 'vault' && (
        <div className="stage vault-stage">
          <VaultDisplay
            members={members}
            phase={displayedPhase}
            winner={winner}
            onTrigger={spin}
          />
        </div>
      )}

      {viz === 'tarot' && (
        <div className="stage tarot-stage">
          <TarotCards
            members={members}
            phase={displayedPhase}
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
            phase={displayedPhase}
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
