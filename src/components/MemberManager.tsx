import { useState, useRef } from 'react';

interface Props {
  members: string[];
  cycle: string[];
  available: string[];
  teamOrder: string[];
  activeTeam: string;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onResetCycle: () => void;
  onSetActiveTeam: (name: string) => void;
  onAddTeam: (name: string) => void;
  onRemoveTeam: (name: string) => void;
  onRenameTeam: (oldName: string, newName: string) => void;
}

export function MemberManager({
  members, cycle, available, teamOrder, activeTeam,
  onAdd, onRemove, onResetCycle,
  onSetActiveTeam, onAddTeam, onRemoveTeam, onRenameTeam,
}: Props) {
  const [inputValue, setInputValue] = useState('');
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const teamInputRef = useRef<HTMLInputElement>(null);

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

  function handleAddTeam() {
    const trimmed = newTeamName.trim();
    if (!trimmed) return;
    onAddTeam(trimmed);
    setNewTeamName('');
    setIsAddingTeam(false);
  }

  function handleTeamKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAddTeam();
    if (e.key === 'Escape') { setIsAddingTeam(false); setNewTeamName(''); }
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>, oldName: string) {
    if (e.key === 'Enter') {
      onRenameTeam(oldName, editingName);
      setEditingTeam(null);
    }
    if (e.key === 'Escape') setEditingTeam(null);
  }

  function startRename(name: string) {
    setEditingTeam(name);
    setEditingName(name);
  }

  const cycleProgress = members.length > 0
    ? `${cycle.length} / ${members.length} hosted this cycle`
    : null;

  return (
    <div className="member-manager">
      {/* Team tabs */}
      <div className="team-tabs">
        {teamOrder.map(name => (
          <div
            key={name}
            className={`team-tab ${name === activeTeam ? 'active' : ''}`}
          >
            {editingTeam === name ? (
              <input
                className="team-tab-edit"
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                onKeyDown={e => handleRenameKeyDown(e, name)}
                onBlur={() => { onRenameTeam(name, editingName); setEditingTeam(null); }}
                autoFocus
                maxLength={30}
              />
            ) : (
              <button
                className="team-tab-btn"
                onClick={() => onSetActiveTeam(name)}
                onDoubleClick={() => startRename(name)}
                title="Click to switch, double-click to rename"
              >
                {name}
              </button>
            )}
            {teamOrder.length > 1 && (
              <button
                className="team-tab-remove"
                onClick={() => onRemoveTeam(name)}
                aria-label={`Remove team ${name}`}
                title={`Remove team ${name}`}
              >
                ✕
              </button>
            )}
          </div>
        ))}

        {isAddingTeam ? (
          <input
            ref={teamInputRef}
            className="team-tab-new-input"
            value={newTeamName}
            onChange={e => setNewTeamName(e.target.value)}
            onKeyDown={handleTeamKeyDown}
            onBlur={() => { if (!newTeamName.trim()) setIsAddingTeam(false); }}
            placeholder="Team name…"
            autoFocus
            maxLength={30}
          />
        ) : (
          <button
            className="team-tab-add"
            onClick={() => setIsAddingTeam(true)}
            title="Add a new team"
          >
            +
          </button>
        )}
      </div>

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
