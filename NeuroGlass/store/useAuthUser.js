import { useEffect, useState } from 'react';
import { onAuthChange } from '../lib/wron-auth';

// Opens the optional Sign in screen (reachable from Settings and onboarding).
export function openSignIn(navigation) {
  if (navigation && typeof navigation.navigate === 'function') navigation.navigate('Sign in');
}

// "Skip" / "Not now": continue into the app without an account.
export function skipSignIn(navigation) {
  if (!navigation) return;
  if (typeof navigation.reset === 'function') {
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  } else if (typeof navigation.navigate === 'function') {
    navigation.navigate('Home');
  }
}

export default function useAuthUser() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    let alive = true;
    const off = onAuthChange((u) => {
      if (alive) setUser(u || null);
    });
    return () => {
      alive = false;
      if (typeof off === 'function') off();
    };
  }, []);
  return user;
}
