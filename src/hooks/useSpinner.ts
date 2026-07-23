import { useCallback, useEffect, useRef, useState } from 'react';
import { onValue, ref, runTransaction, set } from 'firebase/database';
import { db } from '../firebase';
import {
  addMemberToState,
  createDefaultTeamState,
  getRoomPaths,
  parseTeamState,
  removeMemberFromState,
  replaceLastSelection,
  resetCycleState,
  selectNext,
  serializeTeamState,
  undoLastSelection,
} from './spinnerState';
import type { SpinSelection, TeamState } from './spinnerState';

const TAB_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
let pickCounter = 0;

export interface SpinEvent extends SpinSelection {
  targetRotation: number;
  tabId: string;
  timestamp: number;
}

function createPickId(): string {
  pickCounter += 1;
  return `${TAB_ID}-${Date.now().toString(36)}-${pickCounter.toString(36)}`;
}

function formatDatabaseError(action: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `${action} failed: ${detail}`;
}

function parseSpinEvent(data: unknown): SpinEvent | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const event = data as Record<string, unknown>;

  if (
    typeof event.targetRotation !== 'number'
    || !Number.isFinite(event.targetRotation)
    || typeof event.winner !== 'string'
    || !event.winner
    || typeof event.pickId !== 'string'
    || !event.pickId
    || typeof event.tabId !== 'string'
    || !event.tabId
    || typeof event.timestamp !== 'number'
    || !Number.isFinite(event.timestamp)
  ) {
    return null;
  }

  return {
    targetRotation: event.targetRotation,
    winner: event.winner,
    pickId: event.pickId,
    tabId: event.tabId,
    timestamp: event.timestamp,
  };
}

export function useSpinner(roomId: string) {
  const paths = getRoomPaths(roomId);
  const [state, setState] = useState<TeamState>(createDefaultTeamState);
  const [loaded, setLoaded] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const stateRef = ref(db, paths.state);
    let initializationStarted = false;

    const unsubscribe = onValue(stateRef, (snapshot) => {
      const data = snapshot.val();

      if (data === null) {
        const initialState = createDefaultTeamState();
        setState(initialState);

        if (!initializationStarted) {
          initializationStarted = true;
          void runTransaction(stateRef, current => (
            current === null ? serializeTeamState(initialState) : undefined
          )).catch(error => {
            setSyncError(formatDatabaseError('Initializing the room', error));
          });
        }
      } else {
        const parsed = parseTeamState(data);
        if (parsed) {
          setState(parsed);
        } else {
          setSyncError('This room contains invalid data and was not overwritten.');
        }
      }

      setLoaded(true);
    }, error => {
      setSyncError(formatDatabaseError('Loading the room', error));
      setLoaded(true);
    });

    return unsubscribe;
  }, [paths.state]);

  const runStateTransaction = useCallback(async (
    action: string,
    updater: (current: TeamState) => TeamState | null,
  ): Promise<TeamState | null> => {
    try {
      const result = await runTransaction(ref(db, paths.state), currentData => {
        const current = currentData === null
          ? createDefaultTeamState()
          : parseTeamState(currentData);
        if (!current) return undefined;

        const next = updater(current);
        return next ? serializeTeamState(next) : undefined;
      });

      if (!result.committed) return null;

      const committed = parseTeamState(result.snapshot.val());
      if (!committed) {
        setSyncError(`${action} committed invalid room data.`);
        return null;
      }

      setSyncError(null);
      return committed;
    } catch (error) {
      setSyncError(formatDatabaseError(action, error));
      return null;
    }
  }, [paths.state]);

  const available = state.members.filter(member => !state.cycle.includes(member));

  const pickNext = useCallback(async (): Promise<SpinSelection | null> => {
    const pickId = createPickId();
    const committed = await runStateTransaction('Selecting the next host', current => (
      selectNext(current, pickId)?.state ?? null
    ));

    if (!committed?.lastPicked || committed.lastPickId !== pickId) return null;
    return { winner: committed.lastPicked, pickId };
  }, [runStateTransaction]);

  const respin = useCallback(async (
    previous: SpinSelection,
  ): Promise<SpinSelection | null> => {
    const pickId = createPickId();
    const committed = await runStateTransaction('Selecting a replacement host', current => (
      replaceLastSelection(current, previous, pickId)?.state ?? null
    ));

    if (!committed?.lastPicked || committed.lastPickId !== pickId) return null;
    return { winner: committed.lastPicked, pickId };
  }, [runStateTransaction]);

  const undoPick = useCallback(async (selection: SpinSelection): Promise<boolean> => {
    const committed = await runStateTransaction('Undoing the selected host', current => (
      undoLastSelection(current, selection)
    ));
    return committed !== null;
  }, [runStateTransaction]);

  const addMember = useCallback((name: string) => {
    void runStateTransaction('Adding the team member', current => (
      addMemberToState(current, name)
    ));
  }, [runStateTransaction]);

  const removeMember = useCallback((name: string) => {
    void runStateTransaction('Removing the team member', current => (
      removeMemberFromState(current, name)
    ));
  }, [runStateTransaction]);

  const resetCycle = useCallback(() => {
    void runStateTransaction('Resetting the cycle', resetCycleState);
  }, [runStateTransaction]);

  const [remoteSpinEvent, setRemoteSpinEvent] = useState<SpinEvent | null>(null);
  const lastHandledSpinId = useRef<string | null>(null);

  const broadcastSpin = useCallback((
    event: Omit<SpinEvent, 'tabId' | 'timestamp'>,
  ) => {
    const fullEvent: SpinEvent = {
      ...event,
      tabId: TAB_ID,
      timestamp: Date.now(),
    };
    lastHandledSpinId.current = fullEvent.pickId;
    void set(ref(db, paths.spin), fullEvent).catch(error => {
      setSyncError(formatDatabaseError('Sharing the spin', error));
    });
  }, [paths.spin]);

  useEffect(() => {
    const spinRef = ref(db, paths.spin);
    let receivedInitialValue = false;

    return onValue(spinRef, (snapshot) => {
      const event = parseSpinEvent(snapshot.val());

      if (!receivedInitialValue) {
        receivedInitialValue = true;
        if (event) lastHandledSpinId.current = event.pickId;
        return;
      }

      if (
        !event
        || event.tabId === TAB_ID
        || event.pickId === lastHandledSpinId.current
      ) {
        return;
      }
      lastHandledSpinId.current = event.pickId;
      setRemoteSpinEvent(event);
    }, error => {
      setSyncError(formatDatabaseError('Listening for team spins', error));
    });
  }, [paths.spin]);

  const clearRemoteSpin = useCallback(() => {
    setRemoteSpinEvent(null);
  }, []);

  return {
    state,
    available,
    loaded,
    syncError,
    pickNext,
    respin,
    undoPick,
    addMember,
    removeMember,
    resetCycle,
    broadcastSpin,
    remoteSpinEvent,
    clearRemoteSpin,
  };
}

export type { SpinSelection, TeamState } from './spinnerState';
