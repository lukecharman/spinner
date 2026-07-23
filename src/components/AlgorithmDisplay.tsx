import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type Phase = 'idle' | 'spinning' | 'done';

interface Props {
  members: string[];
  phase: Phase;
  winner: string | null;
  onTrigger: () => void;
}

interface CodeLineProps {
  number: number;
  className?: string;
  children?: ReactNode;
}

function hashValue(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function formatHash(name: string | null, iteration: number): string {
  if (!name) return '0x--------';
  return `0x${hashValue(`${name}:${iteration}`).toString(16).padStart(8, '0').toUpperCase()}`;
}

function formatScore(name: string | null, iteration: number): string {
  if (!name) return '0.000000';
  return ((hashValue(`${iteration}:${name}:entropy`) % 1_000_000) / 1_000_000).toFixed(6);
}

function CodeLine({ number, className = '', children }: CodeLineProps) {
  return (
    <div className={`algorithm-code-line ${className}`}>
      <span className="algorithm-line-number">{number}</span>
      <code>{children ?? '\u00a0'}</code>
    </div>
  );
}

export function AlgorithmDisplay({ members, phase, winner, onTrigger }: Props) {
  const [iteration, setIteration] = useState(0);
  const activeRowRef = useRef<HTMLDivElement>(null);
  const hasMembers = members.length > 0;

  useEffect(() => {
    if (phase !== 'spinning' || members.length === 0) return;

    let step = 0;
    const tick = () => {
      setIteration(step);
      step += 1;
    };
    const firstTick = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 145);

    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(interval);
    };
  }, [members.length, phase]);

  const winnerIndex = winner ? members.indexOf(winner) : -1;
  const activeIndex = phase === 'done'
    ? winnerIndex
    : phase === 'spinning' && hasMembers
      ? iteration % members.length
      : -1;
  const displayIteration = phase === 'idle' ? 0 : iteration;

  useEffect(() => {
    if (activeIndex < 0) return;
    activeRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const activeName = activeIndex >= 0 ? members[activeIndex] : null;
  const traceHash = formatHash(activeName, displayIteration);
  const traceScore = formatScore(activeName, displayIteration);
  const closeArrayLine = Math.max(members.length, 1) + 4;
  const status = phase === 'spinning' ? 'RUNNING' : phase === 'done' ? 'SUCCESS' : 'READY';
  const decision = phase === 'done'
    ? 'RETURN'
    : phase === 'spinning'
      ? displayIteration % 5 === 0 ? 'RETAIN' : 'CONTINUE'
      : 'PENDING';

  const trigger = () => {
    setIteration(0);
    onTrigger();
  };

  return (
    <div className={`algorithm-display algorithm-${phase}`}>
      <button
        type="button"
        className="algorithm-trigger"
        onClick={trigger}
        disabled={!hasMembers || phase === 'spinning'}
        aria-label={hasMembers ? (phase === 'done' ? 'Run the selection algorithm again' : 'Run the selection algorithm') : 'Add members before running the algorithm'}
      >
        <span className="algorithm-window">
          <span className="algorithm-titlebar">
            <span className="algorithm-window-controls" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="algorithm-tab">
              <span className="algorithm-ts-icon">TS</span>
              host-selector.ts
            </span>
            <span className={`algorithm-run-state algorithm-state-${phase}`}>
              <span className="algorithm-state-dot" />
              {status}
            </span>
          </span>

          <span className="algorithm-progress" aria-hidden="true">
            <span className="algorithm-progress-fill" />
          </span>

          <span className="algorithm-workspace">
            <span className="algorithm-main">
              <span className="algorithm-breadcrumb">
                src <span>›</span> selection <span>›</span> <strong>selectHost()</strong>
              </span>

              <span className="algorithm-editor">
                <CodeLine number={1}>
                  <span className="token-keyword">type</span>{' '}
                  <span className="token-type">Candidate</span>{' = '}
                  {'{ '}<span className="token-property">name</span>
                  {': '}<span className="token-type">string</span>
                  {'; '}<span className="token-property">score</span>
                  {': '}<span className="token-type">number</span>{' };'}
                </CodeLine>
                <CodeLine number={2} />
                <CodeLine number={3}>
                  <span className="token-keyword">const</span>{' '}
                  <span className="token-variable">candidates</span>
                  {': '}<span className="token-keyword">readonly</span>{' '}
                  <span className="token-type">string</span>{'[] = ['}
                </CodeLine>

                {members.length === 0 && (
                  <CodeLine number={4}>
                    {'  '}<span className="token-comment">// TODO: add team members</span>
                  </CodeLine>
                )}

                {members.map((name, index) => {
                  const isActive = index === activeIndex;
                  const isWinner = phase === 'done' && name === winner;
                  return (
                    <div
                      key={name}
                      ref={isActive ? activeRowRef : undefined}
                      className={[
                        'algorithm-code-line',
                        'algorithm-candidate-line',
                        isActive ? 'algorithm-active-line' : '',
                        isWinner ? 'algorithm-winner-line' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <span className="algorithm-line-number">{index + 4}</span>
                      <code>
                        <span className="algorithm-execution-pointer">{isActive ? '▶' : ' '}</span>
                        <span className="token-string">{JSON.stringify(name)}</span>
                        <span className="token-punctuation">,</span>
                        <span className="token-comment">{` // candidates[${index}]`}</span>
                      </code>
                    </div>
                  );
                })}

                <CodeLine number={closeArrayLine}>
                  {'];'}
                </CodeLine>
                <CodeLine number={closeArrayLine + 1} />
                <CodeLine number={closeArrayLine + 2}>
                  <span className="token-keyword">function</span>{' '}
                  <span className="token-function">selectHost</span>
                  {'(input: '}<span className="token-keyword">readonly</span>{' '}
                  <span className="token-type">string</span>{'[]): '}
                  <span className="token-type">string</span>{' {'}
                </CodeLine>
                <CodeLine number={closeArrayLine + 3}>
                  {'  '}<span className="token-keyword">return</span>{' input'}
                  <span className="token-function">.map</span>{'(evaluateEntropy)'}
                </CodeLine>
                <CodeLine number={closeArrayLine + 4}>
                  {'    '}<span className="token-function">.sort</span>
                  {'(descendingScore)'}
                </CodeLine>
                <CodeLine number={closeArrayLine + 5}>
                  {'    '}<span className="token-function">.at</span>
                  {'('}<span className="token-number">0</span>{')!.name;'}
                </CodeLine>
                <CodeLine number={closeArrayLine + 6}>
                  {'}'}
                </CodeLine>
                <CodeLine
                  number={closeArrayLine + 7}
                  className={phase === 'done' ? 'algorithm-return-line' : ''}
                >
                  <span className="token-keyword">const</span>{' '}
                  <span className="token-variable">selected</span>
                  {' = '}<span className="token-function">selectHost</span>
                  {'(candidates); '}
                  <span className="token-comment">
                    {phase === 'done' && winner ? `// ${JSON.stringify(winner)}` : '// awaiting execution'}
                  </span>
                </CodeLine>
              </span>
            </span>

            <span className="algorithm-trace">
              <span className="algorithm-trace-header">
                <span>Algorithm trace</span>
                <span className="algorithm-complexity">O(n log n)</span>
              </span>
              <span className="algorithm-trace-grid">
                <span className="algorithm-trace-row">
                  <span>iteration</span>
                  <strong>{String(displayIteration).padStart(4, '0')}</strong>
                </span>
                <span className="algorithm-trace-row">
                  <span>cursor</span>
                  <strong>{activeIndex >= 0 ? `candidates[${activeIndex}]` : 'null'}</strong>
                </span>
                <span className="algorithm-trace-row">
                  <span>hash</span>
                  <strong>{traceHash}</strong>
                </span>
                <span className="algorithm-trace-row">
                  <span>score</span>
                  <strong>{traceScore}</strong>
                </span>
                <span className="algorithm-trace-row">
                  <span>decision</span>
                  <strong className={`algorithm-decision algorithm-decision-${decision.toLowerCase()}`}>
                    {decision}
                  </strong>
                </span>
              </span>

              <span className="algorithm-console">
                <span className="algorithm-console-line">
                  <span className="console-prefix">›</span> initializing entropy source
                </span>
                <span className="algorithm-console-line">
                  <span className="console-prefix">›</span>{' '}
                  {activeName ? `evaluate(${JSON.stringify(activeName)})` : 'await selectHost(candidates)'}
                </span>
                <span className="algorithm-console-line">
                  <span className="console-prefix">›</span>{' '}
                  fairness invariant: <span className="console-ok">PASS</span>
                </span>
                {phase === 'done' && winner && (
                  <>
                    <span className="algorithm-console-line algorithm-console-result">
                      return {JSON.stringify(winner)}
                    </span>
                    <span className="algorithm-console-line console-ok">
                      Process exited with code 0
                    </span>
                  </>
                )}
              </span>
            </span>
          </span>

          <span className="algorithm-statusbar">
            <span>main*</span>
            <span>Ln {Math.max(activeIndex + 4, 1)}, Col 3</span>
            <span>UTF-8</span>
            <span>TypeScript</span>
            <span className="algorithm-run-command">
              {phase === 'spinning' ? 'executing…' : phase === 'done' ? 'run again' : hasMembers ? 'run ▶' : 'no input'}
            </span>
          </span>
        </span>
      </button>
    </div>
  );
}
