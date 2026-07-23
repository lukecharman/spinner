import assert from 'node:assert/strict';
import test from 'node:test';
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
} from '../src/hooks/spinnerState.js';
import type { TeamState } from '../src/hooks/spinnerState.js';
import { hashRoomCode, isRoomId } from '../src/room.js';

function team(members: string[], cycle: string[] = []): TeamState {
  return {
    members,
    cycle,
    lastPicked: cycle.at(-1) ?? null,
    lastPickId: cycle.length > 0 ? 'existing-pick' : null,
  };
}

test('an intentionally empty room survives Firebase empty-value stripping', () => {
  const empty = resetCycleState(team([]));
  const stored = serializeTeamState(empty);

  assert.equal(stored.initialized, true);
  assert.deepEqual(parseTeamState({ initialized: true }), empty);
});

test('legacy room data is parsed and invalid cycle entries are removed', () => {
  assert.deepEqual(parseTeamState({
    members: [' Alice ', 'Bob', 'Bob', 42],
    cycle: ['Bob', 'Missing', 'Bob'],
    lastPicked: 'Missing',
  }), {
    members: ['Alice', 'Bob'],
    cycle: ['Bob'],
    lastPicked: null,
    lastPickId: null,
  });

  assert.equal(parseTeamState({ initialized: true, members: 'Alice' }), null);
  assert.equal(parseTeamState({ cycle: [] }), null);
});

test('a cycle remembers every completed turn until the next cycle starts', () => {
  const initial = team(['Alice', 'Bob', 'Carol']);
  const first = selectNext(initial, 'pick-1', () => 0);
  const second = selectNext(first!.state, 'pick-2', () => 0);
  const third = selectNext(second!.state, 'pick-3', () => 0);

  assert.equal(first!.selection.winner, 'Alice');
  assert.equal(second!.selection.winner, 'Bob');
  assert.equal(third!.selection.winner, 'Carol');
  assert.deepEqual(third!.state.cycle, ['Alice', 'Bob', 'Carol']);

  const nextCycle = selectNext(third!.state, 'pick-4', () => 0.99);
  assert.equal(nextCycle!.selection.winner, 'Carol');
  assert.deepEqual(nextCycle!.state.cycle, ['Carol']);
});

test('sequential transaction retries cannot select someone twice in a cycle', () => {
  const initial = team(['Alice', 'Bob']);
  const firstCommit = selectNext(initial, 'tab-a', () => 0)!.state;
  const retriedCommit = selectNext(firstCommit, 'tab-b', () => 0)!.state;

  assert.deepEqual(retriedCommit.cycle, ['Alice', 'Bob']);
  assert.equal(retriedCommit.lastPicked, 'Bob');
});

test('a re-spin atomically replaces only the current selection', () => {
  const first = selectNext(team(['Alice', 'Bob', 'Carol']), 'pick-1', () => 0)!;
  const replacement = replaceLastSelection(
    first.state,
    first.selection,
    'pick-2',
    () => 0.99,
  );

  assert.equal(replacement!.selection.winner, 'Carol');
  assert.deepEqual(replacement!.state.cycle, ['Carol']);
  assert.equal(
    replaceLastSelection(replacement!.state, first.selection, 'stale', () => 0),
    null,
  );
});

test('undo and reset preserve members while clearing turn ownership', () => {
  const picked = selectNext(team(['Alice', 'Bob']), 'pick-1', () => 0)!;
  const undone = undoLastSelection(picked.state, picked.selection);

  assert.deepEqual(undone, team(['Alice', 'Bob']));
  assert.equal(undoLastSelection(picked.state, { winner: 'Alice', pickId: 'stale' }), null);

  const reset = resetCycleState({
    ...picked.state,
    cycle: ['Alice', 'Bob'],
  });
  assert.deepEqual(reset, team(['Alice', 'Bob']));
});

test('member changes keep cycle and last-pick data internally consistent', () => {
  const picked = selectNext(team(['Alice', 'Bob']), 'pick-1', () => 0)!;
  const removed = removeMemberFromState(picked.state, 'Alice');

  assert.deepEqual(removed, team(['Bob']));
  assert.deepEqual(addMemberToState(removed!, ' Carol '), team(['Bob', 'Carol']));
  assert.equal(addMemberToState(removed!, 'Bob'), null);
});

test('room paths isolate state and spin events for each room', () => {
  const first = getRoomPaths('1111111111111111');
  const second = getRoomPaths('2222222222222222');

  assert.notEqual(first.state, second.state);
  assert.notEqual(first.spin, second.spin);
  assert.match(first.state, /^rooms\/1111111111111111\//);
  assert.match(second.spin, /^rooms\/2222222222222222\//);
});

test('room codes are canonical across case and whitespace but isolate different rooms', async () => {
  const first = await hashRoomCode('  Falcon-Maple-Quest ');
  const sameRoom = await hashRoomCode('falcon-maple-quest');
  const otherRoom = await hashRoomCode('falcon-maple-other');

  assert.equal(first, sameRoom);
  assert.notEqual(first, otherRoom);
  assert.equal(isRoomId(first), true);
  assert.equal(isRoomId('not-a-room-id'), false);
});

test('default state returns fresh arrays for each room', () => {
  const first = createDefaultTeamState();
  const second = createDefaultTeamState();
  first.members.push('Frank');

  assert.equal(second.members.includes('Frank'), false);
});
