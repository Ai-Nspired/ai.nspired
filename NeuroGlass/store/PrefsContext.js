import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'goblin:prefs:v1';

export const LANGUAGES = [
  'Automatic', 'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Dutch',
  'Swedish', 'Norwegian', 'Danish', 'Polish', 'Japanese', 'Chinese', 'Korean', 'Arabic', 'Hindi',
];

const DEFAULTS = { mode: 'auto', language: 'Automatic', spice: 3 };

const PrefsContext = createContext({
  ...DEFAULTS,
  ready: false,
  setMode: () => {},
  setLanguage: () => {},
  setSpice: () => {},
});

export function PrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!alive) return;
        if (raw) {
          try {
            setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
          } catch (e) {
            setPrefs(DEFAULTS);
          }
        }
      })
      .catch(() => {})
      .finally(() => alive && setReady(true));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(KEY, JSON.stringify(prefs)).catch(() => {});
  }, [ready, prefs]);

  const setMode = useCallback((mode) => setPrefs((p) => ({ ...p, mode })), []);
  const setLanguage = useCallback((language) => setPrefs((p) => ({ ...p, language })), []);
  const setSpice = useCallback((spice) => setPrefs((p) => ({ ...p, spice: Math.max(1, Math.min(5, Number(spice) || 3)) })), []);

  const value = useMemo(
    () => ({ ...prefs, ready, setMode, setLanguage, setSpice }),
    [prefs, ready, setMode, setLanguage, setSpice]
  );
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  return useContext(PrefsContext);
}
