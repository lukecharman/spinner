import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

type Phase = 'idle' | 'spinning' | 'done';

interface Props {
  members: string[];
  phase: Phase;
  winner: string | null;
  onTrigger: () => void;
}

const SCAN_INTERVAL_MS = 640;
const LOCK_DELAY_MS = 4850;
const LOCKED_STEP = -1;
const CANDIDATE_STEP_PX = 104;

const REJECTION_LINES = [
  'No, not that one. Weird calendar energy.',
  'Hmm. Too many browser tabs. Unstable cargo.',
  'Rejected. Suspiciously cheerful on Mondays.',
  'Zorp blorp... nope. Bad vibes.',
  'No. They said "quick sync" unironically.',
  'Scanning... mostly coffee.',
  'Too powerful. They know Vim.',
  'Already abducted emotionally. Next.',
  'Nope. Clearly on mute.',
  'Fourteen unread Jira tickets. Pass.',
  'Insufficient snacks. Continue search.',
  'Absolutely not. They use Reply All.',
];

const LOCK_LINES = [
  'WAIT. Premium Earthling detected.',
  'Oh! This one comes with snacks.',
  'Hold the beam! Excellent host energy.',
  'Bingo. Weird little human acquired.',
];

const DONE_LINES = [
  'Excellent. This is our problem now.',
  'Advanced science has spoken. No refunds.',
  'Specimen secured. Warranty immediately void.',
  'Perfect. Prepare the tiny paperwork.',
];

const STARS = Array.from({ length: 30 }, (_, index) => ({
  left: (index * 37 + 11) % 98,
  top: (index * 53 + 7) % 72,
  size: 1 + (index % 3),
  delay: -((index * 0.37) % 3),
}));

function nameSeed(name: string): number {
  let seed = 0;
  for (let index = 0; index < name.length; index++) {
    seed = (seed + name.charCodeAt(index) * (index + 3)) % 997;
  }
  return seed;
}

function candidateStyle(index: number): CSSProperties {
  return {
    '--ufo-human-hue': `${(index * 61 + 188) % 360}`,
    '--ufo-human-delay': `${-((index * 0.17) % 1.2)}s`,
  } as CSSProperties;
}

function trackStyle(focusedIndex: number): CSSProperties {
  const offset = -(focusedIndex * CANDIDATE_STEP_PX + 48);
  return { '--ufo-track-offset': `${offset}px` } as CSSProperties;
}

export function UfoDisplay({ members, phase, winner, onTrigger }: Props) {
  const [scanStep, setScanStep] = useState(0);
  const hasMembers = members.length > 0;
  const locked = phase === 'spinning' && scanStep === LOCKED_STEP;
  const rejectedMembers = winner
    ? members.filter(member => member !== winner)
    : members;

  useEffect(() => {
    if (phase !== 'spinning' || !winner) return;

    let step = 0;
    const tick = () => {
      setScanStep(step);
      step += 1;
    };
    const firstTick = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, SCAN_INTERVAL_MS);
    const lock = window.setTimeout(() => {
      window.clearInterval(interval);
      setScanStep(LOCKED_STEP);
    }, LOCK_DELAY_MS);

    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(interval);
      window.clearTimeout(lock);
    };
  }, [members.length, phase, winner]);

  const scanningName = rejectedMembers.length > 0
    ? rejectedMembers[Math.max(scanStep, 0) % rejectedMembers.length]
    : winner;
  const activeName = phase === 'done' || locked
    ? winner
    : phase === 'spinning' && winner
      ? scanningName
      : null;
  const activeIndex = activeName ? members.indexOf(activeName) : -1;
  const focusedIndex = activeIndex >= 0 ? activeIndex : (members.length - 1) / 2;

  let dialogue = 'Tap anywhere. I left the ethics forms at home.';
  if (!hasMembers) {
    dialogue = 'No Earthlings detected. Suspicious.';
  } else if (phase === 'spinning' && !winner) {
    dialogue = 'Calibrating beam... Windows is updating.';
  } else if (phase === 'spinning' && locked && winner) {
    dialogue = LOCK_LINES[nameSeed(winner) % LOCK_LINES.length];
  } else if (phase === 'spinning' && rejectedMembers.length === 0) {
    dialogue = 'Only one? This meeting could have been an email.';
  } else if (phase === 'spinning' && activeName) {
    const lineIndex = (Math.max(scanStep, 0) + nameSeed(activeName)) % REJECTION_LINES.length;
    dialogue = REJECTION_LINES[lineIndex];
  } else if (phase === 'done' && winner) {
    dialogue = DONE_LINES[nameSeed(winner) % DONE_LINES.length];
  }

  const alienMood = phase === 'done' || locked
    ? 'delighted'
    : phase === 'spinning'
      ? 'judging'
      : 'idle';
  const prompt = !hasMembers
    ? 'Add some Earthlings before activating the tractor beam'
    : phase === 'spinning'
      ? locked ? 'Target locked. Regrettable paperwork commencing...' : 'Assessing questionable life forms...'
      : phase === 'done'
        ? 'Tap to return absolutely nobody and abduct again'
        : 'Tap the scene to begin a completely ethical selection process';

  return (
    <div className={`ufo-display ufo-${phase} ${locked ? 'ufo-locked' : ''}`}>
      <button
        type="button"
        className="ufo-trigger"
        onClick={onTrigger}
        disabled={!hasMembers || phase === 'spinning'}
        aria-label={hasMembers ? (phase === 'done' ? 'Abduct another team member' : 'Begin UFO abduction') : 'Add members before beginning UFO abduction'}
      >
        <span className="ufo-scene">
          <span className="ufo-stars" aria-hidden="true">
            {STARS.map((star, index) => (
              <span
                key={index}
                className="ufo-star"
                style={{
                  left: `${star.left}%`,
                  top: `${star.top}%`,
                  width: `${star.size}px`,
                  height: `${star.size}px`,
                  animationDelay: `${star.delay}s`,
                }}
              />
            ))}
          </span>

          <span className="ufo-moon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>

          <span className="ufo-agency-badge">
            Galactic HR
            <span>Random Abduction Unit</span>
          </span>

          <span key={dialogue} className="ufo-speech" aria-hidden="true">
            {dialogue}
          </span>

          <span className="ufo-beam" aria-hidden="true">
            <span className="ufo-beam-particle ufo-particle-one" />
            <span className="ufo-beam-particle ufo-particle-two" />
            <span className="ufo-beam-particle ufo-particle-three" />
            <span className="ufo-beam-particle ufo-particle-four" />
          </span>

          <span className={`ufo-craft ufo-alien-${alienMood}`} aria-hidden="true">
            <span className="ufo-dome">
              <span className="ufo-alien">
                <span className="ufo-alien-ear ufo-alien-ear-left" />
                <span className="ufo-alien-ear ufo-alien-ear-right" />
                <span className="ufo-alien-head">
                  <span className="ufo-alien-eyebrow ufo-alien-eyebrow-left" />
                  <span className="ufo-alien-eyebrow ufo-alien-eyebrow-right" />
                  <span className="ufo-alien-eye ufo-alien-eye-left">
                    <span />
                  </span>
                  <span className="ufo-alien-eye ufo-alien-eye-right">
                    <span />
                  </span>
                  <span className="ufo-alien-mouth" />
                </span>
                <span className="ufo-alien-body">
                  <span className="ufo-alien-arm ufo-alien-arm-left" />
                  <span className="ufo-alien-arm ufo-alien-arm-right" />
                  <span className="ufo-alien-tie" />
                </span>
                <span className="ufo-clipboard">
                  <span />
                  <span />
                  <span />
                </span>
              </span>
            </span>
            <span className="ufo-saucer-rim">
              <span className="ufo-saucer-light" />
              <span className="ufo-saucer-light" />
              <span className="ufo-saucer-light" />
              <span className="ufo-saucer-light" />
              <span className="ufo-saucer-light" />
            </span>
            <span className="ufo-saucer-base" />
          </span>

          <span className="ufo-hills" aria-hidden="true">
            <span className="ufo-hill ufo-hill-left" />
            <span className="ufo-hill ufo-hill-right" />
            <span className="ufo-city">
              <span />
              <span />
              <span />
              <span />
              <span />
            </span>
          </span>

          <span className="ufo-candidate-viewport">
            <span
              className="ufo-candidate-track"
              style={trackStyle(focusedIndex)}
            >
              {members.map((name, index) => {
                const isActive = name === activeName;
                const isWinner = phase === 'done' && name === winner;
                return (
                  <span
                    key={`${name}-${index}`}
                    className={[
                      'ufo-candidate',
                      isActive ? 'ufo-candidate-active' : '',
                      isWinner ? 'ufo-candidate-winner' : '',
                    ].filter(Boolean).join(' ')}
                    style={candidateStyle(index)}
                  >
                    <span className="ufo-human" aria-hidden="true">
                      <span className="ufo-human-hair" />
                      <span className="ufo-human-head">
                        <span className="ufo-human-eyes" />
                        <span className="ufo-human-mouth" />
                      </span>
                      <span className="ufo-human-body">
                        <span className="ufo-human-arm ufo-human-arm-left" />
                        <span className="ufo-human-arm ufo-human-arm-right" />
                      </span>
                      <span className="ufo-human-legs" />
                    </span>
                    <span className="ufo-nameplate" title={name}>{name}</span>
                  </span>
                );
              })}
            </span>
          </span>

          <span className="ufo-ground" aria-hidden="true" />

          <span className="ufo-result" role="status" aria-live="polite">
            {phase === 'done' && winner && (
              <>
                <span>Abduction complete</span>
                <strong>{winner}</strong>
                <small>Return shipping not included</small>
              </>
            )}
          </span>
        </span>
      </button>

      <p className="ufo-prompt">{prompt}</p>
    </div>
  );
}
