export const MAX_MEMBER_NAME_LENGTH = 50;

export interface SpinSelection {
  winner: string;
  pickId: string;
}

export interface TeamState {
  members: string[];
  cycle: string[];
  lastPicked: string | null;
  lastPickId: string | null;
}

interface StoredTeamState {
  initialized: true;
  members: string[];
  cycle: string[];
  lastPicked: string | null;
  lastPickId: string | null;
}

export interface SelectionUpdate {
  state: TeamState;
  selection: SpinSelection;
}

const DEFAULT_MEMBERS = ['Alice', 'Bob', 'Carol', 'Dan', 'Eve'];

export function createDefaultTeamState(): TeamState {
  return {
    members: [...DEFAULT_MEMBERS],
    cycle: [],
    lastPicked: null,
    lastPickId: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return null;

  const entries = Object.entries(value);
  if (!entries.every(([key]) => /^(0|[1-9]\d*)$/.test(key))) return null;

  return entries
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([, item]) => item);
}

function normalizeNames(values: readonly unknown[]): string[] {
  const names: string[] = [];

  for (const value of values) {
    if (typeof value !== 'string') continue;
    const name = value.trim();
    if (!name || name.length > MAX_MEMBER_NAME_LENGTH || names.includes(name)) continue;
    names.push(name);
  }

  return names;
}

export function normalizeTeamState(state: TeamState): TeamState {
  const members = normalizeNames(state.members);
  const memberSet = new Set(members);
  const cycle = normalizeNames(state.cycle).filter(name => memberSet.has(name));
  const lastPicked = typeof state.lastPicked === 'string' && memberSet.has(state.lastPicked)
    ? state.lastPicked
    : null;
  const lastPickId = lastPicked && typeof state.lastPickId === 'string' && state.lastPickId
    ? state.lastPickId
    : null;

  return { members, cycle, lastPicked, lastPickId };
}

export function parseTeamState(data: unknown): TeamState | null {
  if (!isRecord(data)) return null;

  const initialized = data.initialized === true;
  const rawMembers = data.members === undefined ? null : toArray(data.members);
  const rawCycle = data.cycle === undefined ? [] : toArray(data.cycle);

  if ((!initialized && rawMembers === null) || rawCycle === null) return null;
  if (data.members !== undefined && rawMembers === null) return null;

  return normalizeTeamState({
    members: normalizeNames(rawMembers ?? []),
    cycle: normalizeNames(rawCycle),
    lastPicked: typeof data.lastPicked === 'string' ? data.lastPicked : null,
    lastPickId: typeof data.lastPickId === 'string' ? data.lastPickId : null,
  });
}

export function serializeTeamState(state: TeamState): StoredTeamState {
  const normalized = normalizeTeamState(state);
  return {
    initialized: true,
    members: normalized.members,
    cycle: normalized.cycle,
    lastPicked: normalized.lastPicked,
    lastPickId: normalized.lastPickId,
  };
}

function randomIndex(length: number, random: () => number): number {
  const sample = random();
  const bounded = Number.isFinite(sample)
    ? Math.min(Math.max(sample, 0), 0.9999999999999999)
    : 0;
  return Math.floor(bounded * length);
}

export function selectNext(
  state: TeamState,
  pickId: string,
  random: () => number = Math.random,
): SelectionUpdate | null {
  const current = normalizeTeamState(state);
  if (current.members.length === 0 || !pickId) return null;

  let cycle = current.cycle;
  let available = current.members.filter(member => !cycle.includes(member));

  if (available.length === 0) {
    cycle = [];
    available = current.members;
  }

  const winner = available[randomIndex(available.length, random)];
  const selection = { winner, pickId };

  return {
    selection,
    state: {
      ...current,
      cycle: [...cycle, winner],
      lastPicked: winner,
      lastPickId: pickId,
    },
  };
}

export function replaceLastSelection(
  state: TeamState,
  previous: SpinSelection,
  pickId: string,
  random: () => number = Math.random,
): SelectionUpdate | null {
  const current = normalizeTeamState(state);
  if (
    current.lastPicked !== previous.winner
    || current.lastPickId !== previous.pickId
  ) {
    return null;
  }

  return selectNext({
    ...current,
    cycle: current.cycle.filter(member => member !== previous.winner),
    lastPicked: null,
    lastPickId: null,
  }, pickId, random);
}

export function undoLastSelection(
  state: TeamState,
  selection: SpinSelection,
): TeamState | null {
  const current = normalizeTeamState(state);
  if (
    current.lastPicked !== selection.winner
    || current.lastPickId !== selection.pickId
  ) {
    return null;
  }

  return {
    ...current,
    cycle: current.cycle.filter(member => member !== selection.winner),
    lastPicked: null,
    lastPickId: null,
  };
}

export function addMemberToState(state: TeamState, name: string): TeamState | null {
  const current = normalizeTeamState(state);
  const trimmed = name.trim();
  if (
    !trimmed
    || trimmed.length > MAX_MEMBER_NAME_LENGTH
    || current.members.includes(trimmed)
  ) {
    return null;
  }

  return { ...current, members: [...current.members, trimmed] };
}

export function removeMemberFromState(state: TeamState, name: string): TeamState | null {
  const current = normalizeTeamState(state);
  if (!current.members.includes(name)) return null;

  return {
    ...current,
    members: current.members.filter(member => member !== name),
    cycle: current.cycle.filter(member => member !== name),
    lastPicked: current.lastPicked === name ? null : current.lastPicked,
    lastPickId: current.lastPicked === name ? null : current.lastPickId,
  };
}

export function resetCycleState(state: TeamState): TeamState {
  const current = normalizeTeamState(state);
  return { ...current, cycle: [], lastPicked: null, lastPickId: null };
}

export function getRoomPaths(roomId: string) {
  return {
    state: `rooms/${roomId}/spinner-state`,
    spin: `rooms/${roomId}/spin-event`,
  };
}
