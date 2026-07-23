import { useState, useCallback, useEffect } from 'react';
import './App.css';
import { useSpinner } from './hooks/useSpinner';
import { useRoomSettings, useTheme, ACCENT_COLORS } from './hooks/useRoomSettings';
import { SpinnerDisplay } from './components/SpinnerDisplay';
import { MemberManager } from './components/MemberManager';
import { TeamLogin } from './components/TeamLogin';
import { hashRoomCode, isRoomId, normalizeRoomCode } from './room';

const STORAGE_KEY = 'spinner-room';
const ROOM_QUERY_PARAM = 'room';

interface Room {
  roomId: string;
  roomName: string;
}

function getStoredRoom(): Room | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed
      && typeof parsed === 'object'
      && 'roomId' in parsed
      && 'roomName' in parsed
      && typeof parsed.roomId === 'string'
      && isRoomId(parsed.roomId)
      && typeof parsed.roomName === 'string'
      && parsed.roomName.trim()
    ) {
      return { roomId: parsed.roomId, roomName: parsed.roomName.trim() };
    }
  } catch (error) {
    console.warn('Unable to read the saved room.', error);
  }
  return null;
}

function getRoomCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get(ROOM_QUERY_PARAM);
  return code && code.trim() ? code.trim() : null;
}

function setRoomCodeInUrl(code: string | null) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (code) {
    url.searchParams.set(ROOM_QUERY_PARAM, code);
  } else {
    url.searchParams.delete(ROOM_QUERY_PARAM);
  }
  window.history.replaceState({}, '', url.toString());
}

function SpinnerApp({ roomId, roomName, onLeave }: { roomId: string; roomName: string; onLeave: () => void }) {
  const {
    state, available, loaded, syncError, pickNext, respin, undoPick,
    addMember, removeMember, resetCycle,
    broadcastSpin, remoteSpinEvent, clearRemoteSpin,
  } = useSpinner(roomId);
  const {
    accentColor,
    changeAccentColor,
    syncError: settingsError,
  } = useRoomSettings(roomId);
  const { themeSetting, toggleTheme } = useTheme();

  if (!loaded) {
    return <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Loading…</div>;
  }

  return (
    <div className="app">
      <div className="room-bar">
        <span className="room-label">Room: <strong>{roomName}</strong></span>
        <div className="room-settings">
          <div className="color-picker">
            {ACCENT_COLORS.map(c => (
              <button
                key={c.id}
                className={`color-swatch ${c.id === accentColor ? 'active' : ''}`}
                style={{ background: c.hex }}
                onClick={() => changeAccentColor(c.id)}
                aria-label={`Set accent color to ${c.id}`}
                title={c.id}
              />
            ))}
          </div>
          <button className="theme-toggle" onClick={toggleTheme} title={`Theme: ${themeSetting} (click to change)`}>
            {themeSetting === 'dark' ? '🌙' : themeSetting === 'light' ? '☀️' : '💻'}
          </button>
          <button className="room-leave-btn" onClick={onLeave}>Switch Room</button>
        </div>
      </div>
      {(syncError || settingsError) && (
        <div className="sync-error" role="alert">{syncError ?? settingsError}</div>
      )}
      <div className="main-layout">
        <SpinnerDisplay
          members={state.members}
          activePickId={state.lastPickId}
          onSpin={pickNext}
          onRespin={respin}
          onUndo={undoPick}
          onBroadcastSpin={broadcastSpin}
          remoteSpinEvent={remoteSpinEvent}
          onClearRemoteSpin={clearRemoteSpin}
        />

        <div className="side-panel">
          <MemberManager
            members={state.members}
            cycle={state.cycle}
            available={available}
            onAdd={addMember}
            onRemove={removeMember}
            onResetCycle={resetCycle}
          />
        </div>
      </div>
    </div>
  );
}

function App() {
  const [hasInitialRoomLink] = useState(() => getRoomCodeFromUrl() !== null);
  const [room, setRoom] = useState<Room | null>(() => (
    hasInitialRoomLink ? null : getStoredRoom()
  ));
  const [resolvingRoomLink, setResolvingRoomLink] = useState(hasInitialRoomLink);

  const handleJoin = useCallback((roomId: string, roomName: string) => {
    const data = { roomId, roomName: roomName.trim() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Unable to save the current room.', error);
    }
    setRoom(data);
    setResolvingRoomLink(false);
    setRoomCodeInUrl(data.roomName);
  }, []);

  const handleLeave = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Unable to clear the saved room.', error);
    }
    setRoom(null);
    setRoomCodeInUrl(null);
  }, []);

  // Honour ?room=... query param on first load — overrides any stored room.
  useEffect(() => {
    const urlCode = getRoomCodeFromUrl();
    if (!urlCode) {
      // No URL param: keep URL in sync with current room (if any) for shareability.
      if (room) setRoomCodeInUrl(room.roomName);
      return;
    }
    if (room && normalizeRoomCode(room.roomName) === normalizeRoomCode(urlCode)) {
      setRoomCodeInUrl(room.roomName);
      return;
    }
    let cancelled = false;
    hashRoomCode(urlCode).then(roomId => {
      if (cancelled) return;
      handleJoin(roomId, urlCode);
    }).catch(error => {
      if (cancelled) return;
      console.error('Unable to open the linked room.', error);
      setResolvingRoomLink(false);
    });
    return () => { cancelled = true; };
  }, [handleJoin, room]);

  if (resolvingRoomLink) {
    return <div className="app loading-screen">Loading room…</div>;
  }

  if (!room) {
    return <TeamLogin onJoin={handleJoin} />;
  }

  return (
    <SpinnerApp
      key={room.roomId}
      roomId={room.roomId}
      roomName={room.roomName}
      onLeave={handleLeave}
    />
  );
}

export default App;
