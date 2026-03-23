import { useState, useCallback } from 'react';

const STORAGE_KEY = 'standup-spinner';

export interface SpinnerState {
  members: string[];
  cycle: string[];      // names that have already hosted in the current cycle
  lastPicked: string | null;
}

const DEFAULT_MEMBERS = ['Alice', 'Bob', 'Carol', 'Dan', 'Eve'];

function loadState(): SpinnerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SpinnerState>;
      return {
        members: Array.isArray(parsed.members) ? parsed.members : DEFAULT_MEMBERS,
        cycle: Array.isArray(parsed.cycle) ? parsed.cycle : [],
        lastPicked: typeof parsed.lastPicked === 'string' ? parsed.lastPicked : null,
      };
    }
  } catch {
    // ignore corrupt storage
  }
  return { members: DEFAULT_MEMBERS, cycle: [], lastPicked: null };
}

function saveState(state: SpinnerState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useSpinner() {
  const [state, setState] = useState<SpinnerState>(loadState);

  const updateState = useCallback((updater: (prev: SpinnerState) => SpinnerState) => {
    setState(prev => {
      const next = updater(prev);
      saveState(next);
      return next;
    });
  }, []);

  /** Names that haven't hosted yet in the current cycle */
  const available = state.members.filter(m => !state.cycle.includes(m));

  /** Pick the next host at random from the available pool */
  const pickNext = useCallback((): string | null => {
    const pool = state.members.filter(m => !state.cycle.includes(m));
    if (pool.length === 0) return null;
    const winner = pool[Math.floor(Math.random() * pool.length)];
    updateState(prev => {
      const newCycle = [...prev.cycle, winner];
      // Reset cycle once everyone has had a turn
      const resetCycle = newCycle.length >= prev.members.length ? [] : newCycle;
      return { ...prev, cycle: resetCycle, lastPicked: winner };
    });
    return winner;
  }, [state, updateState]);

  const addMember = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed || state.members.includes(trimmed)) return;
    updateState(prev => ({ ...prev, members: [...prev.members, trimmed] }));
  }, [state.members, updateState]);

  const removeMember = useCallback((name: string) => {
    updateState(prev => ({
      ...prev,
      members: prev.members.filter(m => m !== name),
      cycle: prev.cycle.filter(m => m !== name),
      lastPicked: prev.lastPicked === name ? null : prev.lastPicked,
    }));
  }, [updateState]);

  const resetCycle = useCallback(() => {
    updateState(prev => ({ ...prev, cycle: [], lastPicked: null }));
  }, [updateState]);

  return { state, available, pickNext, addMember, removeMember, resetCycle };
}
