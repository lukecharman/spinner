import { useEffect, useState } from 'react';

type Phase = 'idle' | 'spinning' | 'done';

interface Props {
  members: string[];
  phase: Phase;
  winner: string | null;
  onTrigger: () => void;
  onSkip: () => void;
}

const TAROT_TITLES = [
  'The Facilitator',
  'The Victim',
  'The Chosen One',
  'The Sacrifice',
  'The Volunteer',
  'The Scapegoat',
  'The Oracle',
  'The Condemned',
  'The Martyr',
  'The Summoned',
  'The Reluctant Hero',
  'The Tribute',
  'The Destined',
  'The Marked One',
  'The Burdened',
  'The Anointed',
  'The Willing',
  'The Fated',
  'The Offering',
  'The Herald',
];

const TAROT_SYMBOLS = [
  '☽', '✦', '⚝', '☉', '♆', '⚶', '✧', '♄',
  '⚸', '☿', '♃', '⛧', '☊', '♁', '⚹', '⚷',
];

const CARD_SUBTITLES = [
  'The stars have spoken',
  'Fate is sealed',
  'What was foretold comes to pass',
  'The cosmos aligns',
  'Written in the heavens',
  'Destiny awaits',
  'The void has chosen',
  'So it was written',
  'The cards do not lie',
  'Accept thy burden',
];

function pickRandom<T>(arr: T[], exclude?: Set<number>): [T, number] {
  let idx: number;
  do {
    idx = Math.floor(Math.random() * arr.length);
  } while (exclude?.has(idx));
  return [arr[idx], idx];
}

interface CardData {
  title: string;
  symbol: string;
  subtitle: string;
}

function generateCards(): CardData[] {
  const usedTitles = new Set<number>();
  const usedSymbols = new Set<number>();

  const newCards: CardData[] = [];
  for (let i = 0; i < 3; i++) {
    const [title, ti] = pickRandom(TAROT_TITLES, usedTitles);
    usedTitles.add(ti);
    const [symbol, si] = pickRandom(TAROT_SYMBOLS, usedSymbols);
    usedSymbols.add(si);
    const [subtitle] = pickRandom(CARD_SUBTITLES);

    newCards.push({ title, symbol, subtitle });
  }

  return newCards;
}

function randomCardIndex(): number {
  return Math.floor(Math.random() * 3);
}

function pickWinnerIndices(chosen: number, availableCount: number): Set<number> {
  // The chosen card is always a winner. If few people remain, extra cards also
  // get the winner.
  const winnerCardCount = availableCount >= 3 ? 1 : availableCount === 2 ? 2 : 3;
  const indices = new Set<number>([chosen]);
  while (indices.size < winnerCardCount) {
    indices.add(randomCardIndex());
  }
  return indices;
}

function pickLoserNames(
  winner: string,
  winnerIndices: Set<number>,
  members: string[],
): Map<number, string> {
  const names = new Map<number, string>();
  const nonWinnerSlots = [0, 1, 2].filter(i => !winnerIndices.has(i));
  if (nonWinnerSlots.length === 0) return names;

  // Pick other members for the loser cards
  const otherMembers = members.filter(m => m !== winner);
  const pool = otherMembers.length >= nonWinnerSlots.length
    ? otherMembers
    : members; // fall back to full set if not enough others
  const used = new Set<string>([winner]);

  for (const slot of nonWinnerSlots) {
    const available = pool.filter(m => !used.has(m));
    if (available.length > 0) {
      const pick = available[Math.floor(Math.random() * available.length)];
      names.set(slot, pick);
      used.add(pick);
    } else {
      // All exhausted, reuse from full set
      const pick = members[Math.floor(Math.random() * members.length)];
      names.set(slot, pick);
    }
  }
  return names;
}

export function TarotCards({ members, phase, winner, onTrigger, onSkip }: Props) {
  const [cards, setCards] = useState<CardData[]>([]);
  const [chosenIndex, setChosenIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [revealAll, setRevealAll] = useState(false);
  const [winnerIndices, setWinnerIndices] = useState<Set<number>>(new Set());
  const [loserNames, setLoserNames] = useState<Map<number, string>>(new Map());
  const [triggered, setTriggered] = useState(false);

  // Generate a fresh deck when idle without one (initial mount, or members
  // arriving while idle).
  if (phase === 'idle' && members.length > 0 && cards.length === 0) {
    setCards(generateCards());
  }

  // Respond to phase transitions: reset for a new round on idle, or auto-pick a
  // card when a spin is triggered remotely (no local click).
  const [prevPhase, setPrevPhase] = useState<Phase>(phase);
  if (phase !== prevPhase) {
    setPrevPhase(phase);
    if (phase === 'idle' && members.length > 0) {
      setCards(generateCards());
      setChosenIndex(null);
      setRevealAll(false);
      setWinnerIndices(new Set());
      setLoserNames(new Map());
      setTriggered(false);
    } else if (phase === 'spinning' && chosenIndex === null) {
      const index = randomCardIndex();
      const indices = pickWinnerIndices(index, members.length);
      setChosenIndex(index);
      setWinnerIndices(indices);
      if (winner) {
        setLoserNames(pickLoserNames(winner, indices, members));
      }
    }
  }

  // Assign loser names once the winner is known.
  const [prevWinner, setPrevWinner] = useState(winner);
  if (winner !== prevWinner) {
    setPrevWinner(winner);
    if (phase === 'spinning' && winner && winnerIndices.size > 0) {
      setLoserNames(pickLoserNames(winner, winnerIndices, members));
    }
  }

  // When phase becomes 'spinning', we're waiting for user to pick a card
  // The parent has already picked a winner — we just need to animate

  const handleCardClick = (index: number) => {
    if (phase === 'idle' && !triggered) {
      setWinnerIndices(pickWinnerIndices(index, members.length));
      setTriggered(true);
      onTrigger();
      setChosenIndex(index);
    }
  };

  // When phase moves to 'spinning' with a chosen card, flip after delay
  useEffect(() => {
    if (phase !== 'spinning' || chosenIndex === null) return;

    // After a mystical pause, reveal all cards
    const timer = setTimeout(() => {
      setRevealAll(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [phase, chosenIndex]);

  const showPrompt = phase === 'idle' && members.length > 0;

  return (
    <div className="tarot-display">
      {/* Mystical backdrop */}
      <div className="tarot-smoke" />

      <div className="tarot-table">
        {cards.map((card, i) => {
          const isChosen = chosenIndex === i;
          const isFlipped = revealAll && phase !== 'idle';
          const isDone = phase === 'done';
          const isWinnerCard = winnerIndices.has(i);

          return (
            <div
              key={i}
              className={[
                'tarot-card-slot',
                phase === 'idle' && hoveredIndex === i ? 'hovered' : '',
              ].filter(Boolean).join(' ')}
              style={{
                '--slot-rotation': `${[-5, 0, 5][i]}deg`,
              } as React.CSSProperties}
            >
              <div
                className={[
                  'tarot-card-wrapper',
                  isChosen ? 'chosen' : '',
                  isFlipped ? 'flipped' : '',
                  isDone && isWinnerCard ? 'winner-glow' : '',
                  isDone && !isWinnerCard ? 'loser-fade' : '',
                  phase === 'spinning' && chosenIndex !== null && !isChosen ? 'not-chosen' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleCardClick(i)}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  cursor: phase === 'idle' ? 'pointer' : 'default',
                  animationDelay: `${i * 0.15}s`,
                }}
              >
              <div className="tarot-card-inner">
                {/* Back of card */}
                <div className="tarot-card-back">
                  <div className="tarot-card-back-border">
                    <div className="tarot-card-back-pattern">
                      <div className="tarot-star">✦</div>
                      <div className="tarot-eye">◉</div>
                      <div className="tarot-star bottom">✦</div>
                    </div>
                  </div>
                  {phase === 'idle' && hoveredIndex === i && (
                    <div className="tarot-card-hover-text">
                      {['I', 'II', 'III'][i]}
                    </div>
                  )}
                </div>

                {/* Front of card */}
                <div className={`tarot-card-front ${isWinnerCard ? 'tarot-winner' : 'tarot-empty'}`}>
                  <div className="tarot-card-front-inner">
                    {isWinnerCard ? (
                      <>
                        <div className="tarot-card-symbol">{card.symbol}</div>
                        <div className="tarot-card-title">The<br />{card.title.replace(/^The\s+/, '')}</div>
                        <div className="tarot-card-name">{winner}</div>
                        <div className="tarot-card-divider">— ✦ —</div>
                        <div className="tarot-card-subtitle">{card.subtitle}</div>
                      </>
                    ) : (
                      <>
                        <div className="tarot-card-symbol empty-symbol">☽</div>
                        <div className="tarot-card-title empty-title">The<br />Spared</div>
                        <div className="tarot-card-name empty-name">{loserNames.get(i) ?? '?'}</div>
                        <div className="tarot-card-subtitle empty-subtitle">
                          Not this time…
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            </div>
          );
        })}
      </div>

      {showPrompt && (
        <div className="tarot-prompt tarot-prompt-below">Choose your fate…</div>
      )}

      {phase === 'spinning' && chosenIndex !== null && !revealAll && (
        <div className="tarot-prompt tarot-prompt-below tarot-reading">The spirits deliberate…</div>
      )}

      {isDoneWithWinner(phase, winner) && (
        <div className="tarot-result">
          <span className="tarot-result-name">{winner}</span>
          <span className="tarot-result-flavor">has been summoned by the cards</span>
          <button className="skip-btn tarot-skip-btn" onClick={onSkip}>
            Defy Fate (Skip)
          </button>
        </div>
      )}

      {members.length === 0 && (
        <div className="tarot-prompt">The spirits need souls to read…</div>
      )}
    </div>
  );
}

function isDoneWithWinner(phase: Phase, winner: string | null): winner is string {
  return phase === 'done' && winner !== null;
}
