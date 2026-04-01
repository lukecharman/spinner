import { useState, useCallback, useRef, useEffect } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../firebase';

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

const DEFAULT_STATE: TeamState = {
  members: ['Alice', 'Bob', 'Carol', 'Dan', 'Eve'],
  cycle: [],
  lastPicked: null,
};

/** Validate / coerce data from Firebase into a safe TeamState */
function parseState(data: unknown): TeamState | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;

  if (d.members && Array.isArray(d.members)) {
    return {
      members: d.members as string[],
      cycle: Array.isArray(d.cycle) ? d.cycle as string[] : [],
      lastPicked: typeof d.lastPicked === 'string' ? d.lastPicked : null,
    };
  }

  return null;
}

export function useSpinner(roomId: string) {
  const DB_PATH = `rooms/${roomId}/spinner-state`;
  const SPIN_PATH = `rooms/${roomId}/spin-event`;

  const [state, setState] = useState<TeamState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const stateRef = useRef(state);
  const dbPathRef = useRef(DB_PATH);
  dbPathRef.current = DB_PATH;

  function writeState(s: TeamState): void {
    set(ref(db, dbPathRef.current), s);
  }

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
  }, [DB_PATH]);

  const updateState = useCallback((updater: (prev: TeamState) => TeamState) => {
    const prev = stateRef.current;
    const next = updater(prev);
    stateRef.current = next;
    setState(next);
    writeState(next);
  }, []);

  stateRef.current = state;

  const available = state.members.filter(m => !state.cycle.includes(m));

  // ── Member / pick operations ──
  const pickNext = useCallback((): string | null => {
    const t = stateRef.current;
    const pool = t.members.filter(m => !t.cycle.includes(m));
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }, []);

  const confirmPick = useCallback((winner: string) => {
    updateState(t => {
      const newCycle = [...t.cycle, winner];
      const resetCycle = newCycle.length >= t.members.length ? [] : newCycle;
      return { ...t, cycle: resetCycle, lastPicked: winner };
    });
  }, [updateState]);

  const skipPick = useCallback((): string | null => {
    // Undo the last confirmation before re-picking
    const t = stateRef.current;
    if (t.lastPicked && t.cycle.includes(t.lastPicked)) {
      updateState(prev => ({
        ...prev,
        cycle: prev.cycle.filter(m => m !== prev.lastPicked),
        lastPicked: null,
      }));
    }
    // Re-read after undo
    const t2 = stateRef.current;
    const pool = t2.members.filter(m => !t2.cycle.includes(m));
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }, [updateState]);

  const addMember = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateState(t => {
      if (t.members.includes(trimmed)) return t;
      return { ...t, members: [...t.members, trimmed] };
    });
  }, [updateState]);

  const removeMember = useCallback((name: string) => {
    updateState(t => ({
      ...t,
      members: t.members.filter(m => m !== name),
      cycle: t.cycle.filter(m => m !== name),
      lastPicked: t.lastPicked === name ? null : t.lastPicked,
    }));
  }, [updateState]);

  const resetCycle = useCallback(() => {
    updateState(t => ({ ...t, cycle: [], lastPicked: null }));
  }, [updateState]);

  // ── Spin event sync ──
  const [remoteSpinEvent, setRemoteSpinEvent] = useState<SpinEvent | null>(null);
  const lastHandledSpin = useRef(0);
  const mountTime = useRef(Date.now());

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
      // Ignore stale events that existed before this tab loaded
      if (data.timestamp < mountTime.current) return;
      lastHandledSpin.current = data.timestamp;
      setRemoteSpinEvent(data);
    });
    return unsub;
  }, [SPIN_PATH]);

  const clearRemoteSpin = useCallback(() => {
    setRemoteSpinEvent(null);
  }, []);

  return {
    state,
    available,
    loaded,
    pickNext,
    confirmPick,
    skipPick,
    addMember,
    removeMember,
    resetCycle,
    broadcastSpin,
    remoteSpinEvent,
    clearRemoteSpin,
  };
}
