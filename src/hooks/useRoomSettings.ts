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

export function useRoomSettings(roomId: string) {
  const SETTINGS_PATH = `rooms/${roomId}/settings`;
  const [accentColor, setAccentColor] = useState<AccentColor>('purple');

  useEffect(() => {
    const settingsRef = ref(db, SETTINGS_PATH);
    const unsub = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val() as RoomSettings | null;
      if (data?.accentColor) {
        setAccentColor(data.accentColor);
      }
    });
    return unsub;
  }, [SETTINGS_PATH]);

  // Apply accent to document
  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accentColor);
  }, [accentColor]);

  const changeAccentColor = useCallback((color: AccentColor) => {
    set(ref(db, SETTINGS_PATH), { accentColor: color });
  }, [SETTINGS_PATH]);

  return { accentColor, changeAccentColor };
}

export type ThemeSetting = 'dark' | 'light' | 'system';
export type Theme = 'dark' | 'light';

export function useTheme() {
  const [themeSetting, setThemeSetting] = useState<ThemeSetting>(() => {
    return (localStorage.getItem('spinner-theme') as ThemeSetting) || 'dark';
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  const resolved: Theme =
    themeSetting === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themeSetting;

  // Apply theme to the document and persist the user's choice
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved);
    localStorage.setItem('spinner-theme', themeSetting);
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
