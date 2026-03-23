import { useState, useCallback, useRef } from 'react';

const STORAGE_KEY = 'standup-spinner';

export interface TeamState {
  members: string[];
  cycle: string[];
  lastPicked: string | null;
}

export interface AppState {
  teams: Record<string, TeamState>;
  teamOrder: string[];
  activeTeam: string;
}

const DEFAULT_TEAM: TeamState = {
  members: ['Alice', 'Bob', 'Carol', 'Dan', 'Eve'],
  cycle: [],
  lastPicked: null,
};

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate old single-team format
      if (parsed && Array.isArray(parsed.members)) {
        const team: TeamState = {
          members: parsed.members,
          cycle: Array.isArray(parsed.cycle) ? parsed.cycle : [],
          lastPicked: typeof parsed.lastPicked === 'string' ? parsed.lastPicked : null,
        };
        return { teams: { 'Team 1': team }, teamOrder: ['Team 1'], activeTeam: 'Team 1' };
      }
      // New multi-team format
      if (parsed && parsed.teams && parsed.teamOrder) {
        return {
          teams: parsed.teams,
          teamOrder: Array.isArray(parsed.teamOrder) ? parsed.teamOrder : Object.keys(parsed.teams),
          activeTeam: typeof parsed.activeTeam === 'string' && parsed.teams[parsed.activeTeam]
            ? parsed.activeTeam
            : parsed.teamOrder[0] ?? 'Team 1',
        };
      }
    }
  } catch {
    // ignore corrupt storage
  }
  return { teams: { 'Team 1': DEFAULT_TEAM }, teamOrder: ['Team 1'], activeTeam: 'Team 1' };
}

function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useSpinner() {
  const [state, setState] = useState<AppState>(loadState);
  const stateRef = useRef(state);

  const updateState = useCallback((updater: (prev: AppState) => AppState) => {
    setState(prev => {
      const next = updater(prev);
      saveState(next);
      stateRef.current = next;
      return next;
    });
  }, []);

  stateRef.current = state;

  const team = state.teams[state.activeTeam] ?? { members: [], cycle: [], lastPicked: null };
  const available = team.members.filter(m => !team.cycle.includes(m));

  // ── Team management ──
  const setActiveTeam = useCallback((name: string) => {
    updateState(prev => ({ ...prev, activeTeam: name }));
  }, [updateState]);

  const addTeam = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateState(prev => {
      if (prev.teams[trimmed]) return prev; // already exists
      return {
        ...prev,
        teams: { ...prev.teams, [trimmed]: { members: [], cycle: [], lastPicked: null } },
        teamOrder: [...prev.teamOrder, trimmed],
        activeTeam: trimmed,
      };
    });
  }, [updateState]);

  const removeTeam = useCallback((name: string) => {
    updateState(prev => {
      if (prev.teamOrder.length <= 1) return prev; // don't remove last team
      const newTeams = { ...prev.teams };
      delete newTeams[name];
      const newOrder = prev.teamOrder.filter(t => t !== name);
      const newActive = prev.activeTeam === name ? newOrder[0] : prev.activeTeam;
      return { ...prev, teams: newTeams, teamOrder: newOrder, activeTeam: newActive };
    });
  }, [updateState]);

  const renameTeam = useCallback((oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    updateState(prev => {
      if (prev.teams[trimmed]) return prev; // name taken
      const newTeams = { ...prev.teams };
      newTeams[trimmed] = newTeams[oldName];
      delete newTeams[oldName];
      const newOrder = prev.teamOrder.map(t => t === oldName ? trimmed : t);
      const newActive = prev.activeTeam === oldName ? trimmed : prev.activeTeam;
      return { ...prev, teams: newTeams, teamOrder: newOrder, activeTeam: newActive };
    });
  }, [updateState]);

  // ── Helper to update the active team's state ──
  const updateTeam = useCallback((updater: (t: TeamState) => TeamState) => {
    updateState(prev => {
      const current = prev.teams[prev.activeTeam];
      if (!current) return prev;
      return { ...prev, teams: { ...prev.teams, [prev.activeTeam]: updater(current) } };
    });
  }, [updateState]);

  // ── Member / pick operations (scoped to active team) ──
  const pickNext = useCallback((): string | null => {
    const s = stateRef.current;
    const t = s.teams[s.activeTeam];
    if (!t) return null;
    const pool = t.members.filter(m => !t.cycle.includes(m));
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }, []);

  const confirmPick = useCallback((winner: string) => {
    updateTeam(t => {
      const newCycle = [...t.cycle, winner];
      const resetCycle = newCycle.length >= t.members.length ? [] : newCycle;
      return { ...t, cycle: resetCycle, lastPicked: winner };
    });
  }, [updateTeam]);

  const skipPick = useCallback((): string | null => {
    const s = stateRef.current;
    const t = s.teams[s.activeTeam];
    if (!t) return null;
    const pool = t.members.filter(m => !t.cycle.includes(m));
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }, []);

  const addMember = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateTeam(t => {
      if (t.members.includes(trimmed)) return t;
      return { ...t, members: [...t.members, trimmed] };
    });
  }, [updateTeam]);

  const removeMember = useCallback((name: string) => {
    updateTeam(t => ({
      ...t,
      members: t.members.filter(m => m !== name),
      cycle: t.cycle.filter(m => m !== name),
      lastPicked: t.lastPicked === name ? null : t.lastPicked,
    }));
  }, [updateTeam]);

  const resetCycle = useCallback(() => {
    updateTeam(t => ({ ...t, cycle: [], lastPicked: null }));
  }, [updateTeam]);

  return {
    state,
    team,
    available,
    pickNext,
    confirmPick,
    skipPick,
    addMember,
    removeMember,
    resetCycle,
    setActiveTeam,
    addTeam,
    removeTeam,
    renameTeam,
  };
}
