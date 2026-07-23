import type { CSSProperties } from 'react';

type Phase = 'idle' | 'spinning' | 'done';

interface Props {
  members: string[];
  phase: Phase;
  winner: string | null;
  onTrigger: () => void;
}

const BOLTS = [
  { x: 50, y: 7, retractedX: 50, retractedY: 17, angle: 90 },
  { x: 80, y: 19, retractedX: 72, retractedY: 27, angle: 135 },
  { x: 93, y: 50, retractedX: 82, retractedY: 50, angle: 0 },
  { x: 80, y: 81, retractedX: 72, retractedY: 73, angle: 45 },
  { x: 50, y: 93, retractedX: 50, retractedY: 83, angle: 90 },
  { x: 20, y: 81, retractedX: 28, retractedY: 73, angle: 135 },
  { x: 7, y: 50, retractedX: 18, retractedY: 50, angle: 0 },
  { x: 20, y: 19, retractedX: 28, retractedY: 27, angle: 45 },
];

const DIAL_NUMBERS = [
  { label: '00', angle: 0 },
  { label: '25', angle: 90 },
  { label: '50', angle: 180 },
  { label: '75', angle: 270 },
];

function boltStyle(
  bolt: (typeof BOLTS)[number],
  index: number,
): CSSProperties {
  return {
    '--bolt-x': `${bolt.x}%`,
    '--bolt-y': `${bolt.y}%`,
    '--bolt-retracted-x': `${bolt.retractedX}%`,
    '--bolt-retracted-y': `${bolt.retractedY}%`,
    '--bolt-angle': `${bolt.angle}deg`,
    '--bolt-delay': `${4.7 + index * 0.055}s`,
  } as CSSProperties;
}

function dialNumberStyle(angle: number): CSSProperties {
  return { '--dial-number-angle': `${angle}deg` } as CSSProperties;
}

export function VaultDisplay({ members, phase, winner, onTrigger }: Props) {
  const hasMembers = members.length > 0;
  const canTrigger = hasMembers && phase !== 'spinning';
  const actionLabel = phase === 'done' ? 'Crack the vault again' : 'Crack the vault';

  const prompt = !hasMembers
    ? 'Add members to load the vault'
    : phase === 'spinning'
      ? 'Listening for the final tumbler…'
      : phase === 'done'
        ? 'Tap the vault to seal it and choose again'
        : 'Tap the vault to crack the combination';

  return (
    <div className={`vault-display vault-${phase} ${hasMembers ? '' : 'vault-empty'}`}>
      <button
        type="button"
        className="vault-trigger"
        onClick={onTrigger}
        disabled={!canTrigger}
        aria-label={hasMembers ? actionLabel : 'Add members before opening the vault'}
      >
        <span className="vault-scene">
          <span className="vault-housing">
            <span className="vault-chamber">
              <span className="vault-chamber-grid" />
              <span className="vault-reveal" role="status" aria-live="polite">
                {phase === 'done' && winner && (
                  <>
                    <span className="vault-access-label">Access granted</span>
                    <strong className="vault-winner">{winner}</strong>
                    <span className="vault-verdict">The vault has chosen</span>
                  </>
                )}
              </span>
            </span>

            <span className="vault-door">
              <span className="vault-door-face">
                {BOLTS.map((bolt, index) => (
                  <span
                    key={`${bolt.x}-${bolt.y}`}
                    className="vault-bolt"
                    style={boltStyle(bolt, index)}
                  />
                ))}

                <span className="vault-brand">The Vault</span>
                <span className="vault-indicators" aria-hidden="true">
                  <span className="vault-indicator" />
                  <span className="vault-indicator" />
                  <span className="vault-indicator" />
                </span>

                <span className="vault-handle" aria-hidden="true">
                  <span className="vault-handle-spoke vault-spoke-one" />
                  <span className="vault-handle-spoke vault-spoke-two" />
                  <span className="vault-handle-spoke vault-spoke-three" />
                </span>

                <span className="vault-combination" aria-hidden="true">
                  <span className="vault-dial-pointer" />
                  <span className="vault-dial">
                    {DIAL_NUMBERS.map(number => (
                      <span
                        key={number.label}
                        className="vault-dial-number"
                        style={dialNumberStyle(number.angle)}
                      >
                        <span>{number.label}</span>
                      </span>
                    ))}
                    <span className="vault-dial-hub">
                      <span className="vault-keyhole" />
                    </span>
                  </span>
                </span>

                <span className="vault-readout">
                  {phase === 'spinning' ? 'Decoding' : phase === 'done' ? 'Unsealed' : 'Locked'}
                </span>
              </span>
            </span>
          </span>
          <span className="vault-floor-shadow" />
        </span>
      </button>

      <p className="vault-prompt">{prompt}</p>
    </div>
  );
}
