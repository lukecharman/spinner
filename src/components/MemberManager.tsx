import { useState, useRef } from 'react';

interface Props {
  members: string[];
  cycle: string[];      // who has already hosted this cycle
  available: string[];  // who hasn't hosted yet
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onResetCycle: () => void;
}

export function MemberManager({ members, cycle, available, onAdd, onRemove, onResetCycle }: Props) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setInputValue('');
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAdd();
  }

  const cycleProgress = members.length > 0
    ? `${cycle.length} / ${members.length} hosted this cycle`
    : null;

  return (
    <div className="member-manager">
      <h2>Team Members</h2>

      {cycleProgress && (
        <p className="cycle-progress">{cycleProgress}</p>
      )}

      <ul className="member-list" aria-label="Team members">
        {members.length === 0 && (
          <li className="member-empty">No members yet — add some below!</li>
        )}
        {members.map(name => {
          const hasHosted = cycle.includes(name);
          const isAvailable = available.includes(name);
          return (
            <li
              key={name}
              className={`member-item ${hasHosted ? 'hosted' : ''} ${isAvailable ? 'available' : ''}`}
            >
              <span className="member-name">
                {name}
                {hasHosted && <span className="badge hosted-badge" title="Already hosted this cycle">✓</span>}
                {isAvailable && <span className="badge available-badge" title="Available to host">●</span>}
              </span>
              <button
                className="remove-btn"
                onClick={() => onRemove(name)}
                aria-label={`Remove ${name}`}
                title={`Remove ${name}`}
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>

      <div className="add-member-row">
        <input
          ref={inputRef}
          className="add-member-input"
          type="text"
          value={inputValue}
          placeholder="Add a team member…"
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="New team member name"
          maxLength={50}
        />
        <button
          className="add-btn"
          onClick={handleAdd}
          disabled={!inputValue.trim()}
          aria-label="Add team member"
        >
          Add
        </button>
      </div>

      {cycle.length > 0 && (
        <button
          className="reset-btn"
          onClick={onResetCycle}
          title="Clear the current cycle and let everyone host again"
        >
          Reset Cycle
        </button>
      )}
    </div>
  );
}
