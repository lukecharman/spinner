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

function resolveTheme(setting: ThemeSetting): Theme {
  if (setting === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return setting;
}

export function useTheme() {
  const [themeSetting, setThemeSetting] = useState<ThemeSetting>(() => {
    return (localStorage.getItem('spinner-theme') as ThemeSetting) || 'dark';
  });

  const [resolved, setResolved] = useState<Theme>(() => resolveTheme(themeSetting));

  useEffect(() => {
    const r = resolveTheme(themeSetting);
    setResolved(r);
    document.documentElement.setAttribute('data-theme', r);
    localStorage.setItem('spinner-theme', themeSetting);
  }, [themeSetting]);

  // Listen for OS theme changes when in 'system' mode
  useEffect(() => {
    if (themeSetting !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const r = resolveTheme('system');
      setResolved(r);
      document.documentElement.setAttribute('data-theme', r);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [themeSetting]);

  const toggleTheme = useCallback(() => {
    setThemeSetting(prev => prev === 'dark' ? 'light' : prev === 'light' ? 'system' : 'dark');
  }, []);

  return { theme: resolved, themeSetting, toggleTheme };
}
