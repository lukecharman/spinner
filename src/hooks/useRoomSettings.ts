import { useState, useCallback, useEffect } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../firebase';

export type AccentColor = 'purple' | 'blue' | 'green' | 'red' | 'orange' | 'pink' | 'teal' | 'yellow';

export const ACCENT_COLORS: { id: AccentColor; hex: string }[] = [
  { id: 'purple', hex: '#c084fc' },
  { id: 'blue',   hex: '#60a5fa' },
  { id: 'green',  hex: '#4ade80' },
  { id: 'red',    hex: '#f87171' },
  { id: 'orange', hex: '#fb923c' },
  { id: 'pink',   hex: '#f472b6' },
  { id: 'teal',   hex: '#2dd4bf' },
  { id: 'yellow', hex: '#facc15' },
];

interface RoomSettings {
  accentColor: AccentColor;
}

function isAccentColor(value: unknown): value is AccentColor {
  return ACCENT_COLORS.some(color => color.id === value);
}

export function useRoomSettings(roomId: string) {
  const SETTINGS_PATH = `rooms/${roomId}/settings`;
  const [accentColor, setAccentColor] = useState<AccentColor>('purple');
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const settingsRef = ref(db, SETTINGS_PATH);
    const unsub = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val() as RoomSettings | null;
      if (isAccentColor(data?.accentColor)) {
        setAccentColor(data.accentColor);
        setSyncError(null);
      } else if (data !== null) {
        setSyncError('This room has an invalid accent color setting.');
      }
    }, error => {
      setSyncError(`Loading room settings failed: ${error.message}`);
    });
    return unsub;
  }, [SETTINGS_PATH]);

  // Apply accent to document
  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accentColor);
  }, [accentColor]);

  const changeAccentColor = useCallback((color: AccentColor) => {
    void set(ref(db, SETTINGS_PATH), { accentColor: color }).catch(error => {
      setSyncError(`Saving the accent color failed: ${error.message}`);
    });
  }, [SETTINGS_PATH]);

  return { accentColor, changeAccentColor, syncError };
}

export type ThemeSetting = 'dark' | 'light' | 'system';
export type Theme = 'dark' | 'light';

function loadThemeSetting(): ThemeSetting {
  try {
    const saved = localStorage.getItem('spinner-theme');
    if (saved === 'dark' || saved === 'light' || saved === 'system') return saved;
  } catch (error) {
    console.warn('Unable to read the saved theme.', error);
  }
  return 'dark';
}

export function useTheme() {
  const [themeSetting, setThemeSetting] = useState<ThemeSetting>(loadThemeSetting);

  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  const resolved: Theme =
    themeSetting === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themeSetting;

  // Apply theme to the document and persist the user's choice
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved);
    try {
      localStorage.setItem('spinner-theme', themeSetting);
    } catch (error) {
      console.warn('Unable to save the selected theme.', error);
    }
  }, [resolved, themeSetting]);

  // Track OS theme changes (used when in 'system' mode)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setSystemPrefersDark(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeSetting(prev => prev === 'dark' ? 'light' : prev === 'light' ? 'system' : 'dark');
  }, []);

  return { theme: resolved, themeSetting, toggleTheme };
}
