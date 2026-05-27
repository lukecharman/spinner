import { useState, useCallback, useEffect } from 'react';
import './App.css';
import { useSpinner } from './hooks/useSpinner';
import { useRoomSettings, useTheme, ACCENT_COLORS } from './hooks/useRoomSettings';
import { SpinnerDisplay } from './components/SpinnerDisplay';
import { MemberManager } from './components/MemberManager';
import { TeamLogin } from './components/TeamLogin';

const STORAGE_KEY = 'spinner-room';
const ROOM_QUERY_PARAM = 'room';

function getStoredRoom(): { roomId: string; roomName: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.roomId && parsed.roomName) return parsed;
  } catch { /* ignore */ }
  return null;
}

function getRoomCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get(ROOM_QUERY_PARAM);
  return code && code.trim() ? code.trim() : null;
}

async function hashRoomCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code.trim().toLowerCase());
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
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
    state, available, loaded, pickNext, confirmPick, skipPick,
    addMember, removeMember, resetCycle,
    broadcastSpin, remoteSpinEvent, clearRemoteSpin,
  } = useSpinner(roomId);
  const { accentColor, changeAccentColor } = useRoomSettings(roomId);
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
      <div className="main-layout">
        <SpinnerDisplay
          members={state.members}
          onSpin={pickNext}
          onSkip={skipPick}
          onConfirm={confirmPick}
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
  const [room, setRoom] = useState(getStoredRoom);

  const handleJoin = useCallback((roomId: string, roomName: string) => {
    const data = { roomId, roomName };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setRoom(data);
    setRoomCodeInUrl(roomName);
  }, []);

  const handleLeave = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
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
    if (room && room.roomName.trim().toLowerCase() === urlCode.toLowerCase()) {
      setRoomCodeInUrl(room.roomName);
      return;
    }
    let cancelled = false;
    hashRoomCode(urlCode).then(roomId => {
      if (cancelled) return;
      handleJoin(roomId, urlCode);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!room) {
    return <TeamLogin onJoin={handleJoin} />;
  }

  return <SpinnerApp roomId={room.roomId} roomName={room.roomName} onLeave={handleLeave} />;
}

export default App;
