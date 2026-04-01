import { useState, useCallback } from 'react';
import './App.css';
import { useSpinner } from './hooks/useSpinner';
import { useRoomSettings, useTheme, ACCENT_COLORS } from './hooks/useRoomSettings';
import { SpinnerDisplay } from './components/SpinnerDisplay';
import { MemberManager } from './components/MemberManager';
import { TeamLogin } from './components/TeamLogin';

const STORAGE_KEY = 'spinner-room';

function getStoredRoom(): { roomId: string; roomName: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.roomId && parsed.roomName) return parsed;
  } catch { /* ignore */ }
  return null;
}

function SpinnerApp({ roomId, roomName, onLeave }: { roomId: string; roomName: string; onLeave: () => void }) {
  const {
    state, available, loaded, pickNext, confirmPick, skipPick,
    addMember, removeMember, resetCycle,
    broadcastSpin, remoteSpinEvent, clearRemoteSpin,
  } = useSpinner(roomId);
  const { accentColor, changeAccentColor } = useRoomSettings(roomId);
  const { theme, toggleTheme } = useTheme();

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
          <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? '☀️' : '🌙'}
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
  }, []);

  const handleLeave = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setRoom(null);
  }, []);

  if (!room) {
    return <TeamLogin onJoin={handleJoin} />;
  }

  return <SpinnerApp roomId={room.roomId} roomName={room.roomName} onLeave={handleLeave} />;
}

export default App;
