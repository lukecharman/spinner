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

export type Theme = 'dark' | 'light';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('spinner-theme') as Theme) || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('spinner-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  return { theme, toggleTheme };
}
