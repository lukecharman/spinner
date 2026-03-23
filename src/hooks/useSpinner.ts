import { useState, useCallback, useRef, useEffect } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../firebase';

const DB_PATH = 'spinner-state';
const SPIN_PATH = 'spin-event';
const TAB_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export interface SpinEvent {
  targetRotation: number;
  winner: string;
  isSkip: boolean;
  tabId: string;
  timestamp: number;
}

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

const DEFAULT_STATE: AppState = {
  teams: { 'Team 1': DEFAULT_TEAM },
  teamOrder: ['Team 1'],
  activeTeam: 'Team 1',
};

/** Validate / coerce data from Firebase into a safe AppState */
function parseState(data: unknown): AppState | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;

  if (d.teams && d.teamOrder) {
    const teams = d.teams as Record<string, unknown>;
    const teamOrder = Array.isArray(d.teamOrder) ? d.teamOrder as string[] : Object.keys(teams);
    const parsedTeams: Record<string, TeamState> = {};

    for (const [name, raw] of Object.entries(teams)) {
      const t = raw as Record<string, unknown>;
      parsedTeams[name] = {
        members: Array.isArray(t.members) ? t.members : [],
        cycle: Array.isArray(t.cycle) ? t.cycle : [],
        lastPicked: typeof t.lastPicked === 'string' ? t.lastPicked : null,
      };
    }

    // Firebase strips empty objects, so teams in teamOrder may be missing from data
    for (const name of teamOrder) {
      if (!parsedTeams[name]) {
        parsedTeams[name] = { members: [], cycle: [], lastPicked: null };
      }
    }

    const activeTeam = typeof d.activeTeam === 'string' && parsedTeams[d.activeTeam]
      ? d.activeTeam as string
      : teamOrder[0] ?? 'Team 1';

    return { teams: parsedTeams, teamOrder, activeTeam };
  }

  // Migrate old single-team format
  if (d.members && Array.isArray(d.members)) {
    const team: TeamState = {
      members: d.members as string[],
      cycle: Array.isArray(d.cycle) ? d.cycle as string[] : [],
      lastPicked: typeof d.lastPicked === 'string' ? d.lastPicked : null,
    };
    return { teams: { 'Team 1': team }, teamOrder: ['Team 1'], activeTeam: 'Team 1' };
  }

  return null;
}

function writeState(state: AppState): void {
  set(ref(db, DB_PATH), state);
}

export function useSpinner() {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const stateRef = useRef(state);

  // Real-time listener — syncs Firebase → local state
  useEffect(() => {
    const dbRef = ref(db, DB_PATH);
    const unsub = onValue(dbRef, (snapshot) => {
      const data = snapshot.val();
      const parsed = parseState(data);
      if (parsed) {
        setState(parsed);
        stateRef.current = parsed;
      } else if (!data) {
        // First time — seed the database with defaults
        writeState(DEFAULT_STATE);
      }
      setLoaded(true);
    });
    return unsub;
  }, []);

  const updateState = useCallback((updater: (prev: AppState) => AppState) => {
    const prev = stateRef.current;
    const next = updater(prev);
    stateRef.current = next;
    setState(next);
    writeState(next);
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
      if (prev.teams[trimmed]) return prev;
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
      if (prev.teamOrder.length <= 1) return prev;
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
      if (prev.teams[trimmed]) return prev;
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
    // Undo the last confirmation before re-picking
    const s = stateRef.current;
    const t = s.teams[s.activeTeam];
    if (!t) return null;
    if (t.lastPicked && t.cycle.includes(t.lastPicked)) {
      updateTeam(prev => ({
        ...prev,
        cycle: prev.cycle.filter(m => m !== prev.lastPicked),
        lastPicked: null,
      }));
    }
    // Re-read after undo
    const s2 = stateRef.current;
    const t2 = s2.teams[s2.activeTeam];
    if (!t2) return null;
    const pool = t2.members.filter(m => !t2.cycle.includes(m));
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }, [updateTeam]);

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

  // ── Spin event sync ──
  const [remoteSpinEvent, setRemoteSpinEvent] = useState<SpinEvent | null>(null);
  const lastHandledSpin = useRef(0);

  const broadcastSpin = useCallback((event: Omit<SpinEvent, 'tabId' | 'timestamp'>) => {
    const full: SpinEvent = { ...event, tabId: TAB_ID, timestamp: Date.now() };
    lastHandledSpin.current = full.timestamp;
    set(ref(db, SPIN_PATH), full);
  }, []);

  useEffect(() => {
    const spinRef = ref(db, SPIN_PATH);
    const unsub = onValue(spinRef, (snapshot) => {
      const data = snapshot.val() as SpinEvent | null;
      if (!data) return;
      // Ignore our own spins and already-handled events
      if (data.tabId === TAB_ID) return;
      if (data.timestamp <= lastHandledSpin.current) return;
      lastHandledSpin.current = data.timestamp;
      setRemoteSpinEvent(data);
    });
    return unsub;
  }, []);

  const clearRemoteSpin = useCallback(() => {
    setRemoteSpinEvent(null);
  }, []);

  return {
    state,
    team,
    available,
    loaded,
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
    broadcastSpin,
    remoteSpinEvent,
    clearRemoteSpin,
  };
}
