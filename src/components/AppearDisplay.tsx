import { useEffect, useState } from 'react';

type Phase = 'idle' | 'spinning' | 'done';

interface Props {
  members: string[];
  phase: Phase;
  winner: string | null;
  onTrigger: () => void;
}

export function AppearDisplay({ members, phase, winner, onTrigger }: Props) {
  const [dots, setDots] = useState('');

  // Animate dots while "spinning"
  useEffect(() => {
    if (phase !== 'spinning') { setDots(''); return; }
    const id = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 300);
    return () => clearInterval(id);
  }, [phase]);

  return (
    <div className="appear-display" onClick={phase === 'idle' ? onTrigger : undefined}>
      {phase === 'idle' && (
        <div className="appear-prompt">
          {members.length > 0 ? 'Tap to pick' : 'Add members to start'}
        </div>
      )}

      {phase === 'spinning' && (
        <div className="appear-thinking">
          Thinking{dots}
        </div>
      )}

      {phase === 'done' && winner && (
        <div className="appear-result">
          {winner}
        </div>
      )}
    </div>
  );
}
