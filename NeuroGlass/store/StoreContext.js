import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveRecord, listRecords, updateRecord, deleteRecord } from '../lib/wron-db';
import { signIn as authSignIn, signUp as authSignUp, signOut as authSignOut, currentUser, onAuthChange } from '../lib/wron-auth';
import { scheduleReminder, cancelReminder, askNotificationPermission } from '../lib/wron-ai';

const KEY = 'app:state:v1';

const DEFAULT_SETTINGS = {
  remindNow: false,
  remindTime: { hour: 9, minute: 0 },
  remindOsId: null,
  analyticsConsent: false,
  reduceMotion: false,
  dyslexiaFont: false,
  purchased: false,
};

const DEFAULT_BODY = {
  water: 0,
  waterGoal: 8,
  energy: 3,
  mood: 'Calm',
  meds: false,
  day: '',
};

const DEFAULT_PROGRESS = { done: 0, total: 0, streak: 0, day: '' };

function todayKey(d = new Date()) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' : ''}${m}-${day < 10 ? '0' : ''}${day}`;
}

function dayDiff(aKey, bKey) {
  if (!aKey || !bKey) return null;
  const [ay, am, ad] = aKey.split('-').map(Number);
  const [by, bm, bd] = bKey.split('-').map(Number);
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.round((b - a) / 86400000);
}

function emptyWeek() {
  return ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'];
}

function normalizeRoutine(r) {
  const week = Array.isArray(r?.week) && r.week.length === 7 ? r.week : emptyWeek();
  return {
    id: String(r?.id),
    title: r?.title || '',
    time: r?.time || '08:00',
    week,
    graceLeft: typeof r?.graceLeft === 'number' ? r.graceLeft : typeof r?.grace_left === 'number' ? r.grace_left : 2,
    reminderOn: !!(r?.reminderOn ?? r?.reminder_on),
    reminderOsId: r?.reminderOsId || null,
    streak: typeof r?.streak === 'number' ? r.streak : 0,
    lastCheck: r?.lastCheck || r?.last_check || '',
  };
}

function normalizeTask(r) {
  return {
    id: String(r?.id),
    title: r?.title || '',
    minutes: typeof r?.minutes === 'number' ? r.minutes : 10,
    done: !!r?.done,
  };
}

const noop = () => {};
const asyncNoop = async () => {};

const StoreContext = createContext({
  ready: false,
  loading: true,
  onboardingDone: false,
  completeOnboarding: asyncNoop,
  user: null,
  signIn: asyncNoop,
  signUp: asyncNoop,
  signOut: asyncNoop,
  currentStep: null,
  setCurrentStep: noop,
  completeStep: noop,
  pause: noop,
  resume: noop,
  addMinutes: noop,
  swapSmaller: noop,
  progress: DEFAULT_PROGRESS,
  body: DEFAULT_BODY,
  setBody: noop,
  tasks: [],
  addTask: asyncNoop,
  toggleTask: asyncNoop,
  removeTask: asyncNoop,
  startTask: noop,
  parked: [],
  addParked: asyncNoop,
  removeParked: asyncNoop,
  makeTask: asyncNoop,
  routines: [],
  addRoutine: asyncNoop,
  removeRoutine: asyncNoop,
  checkIn: asyncNoop,
  setRoutineTime: asyncNoop,
  setReminder: asyncNoop,
  settings: DEFAULT_SETTINGS,
  updateSettings: noop,
  setRemindNow: asyncNoop,
  setRemindTime: asyncNoop,
  setAnalyticsConsent: noop,
  purchase: asyncNoop,
  restorePurchase: asyncNoop,
  trackEvent: noop,
  bodyDouble: false,
  setBodyDouble: noop,
  clearLocalData: asyncNoop,
  reload: asyncNoop,
});

export function StoreProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [user, setUser] = useState(null);
  const [currentStep, setCurrentStepState] = useState(null);
  const [progress, setProgress] = useState(DEFAULT_PROGRESS);
  const [body, setBodyState] = useState(DEFAULT_BODY);
  const [tasks, setTasks] = useState([]);
  const [parked, setParked] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [bodyDouble, setBodyDouble] = useState(false);
  const [events, setEvents] = useState(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // ---------- load local state ----------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const saved = raw ? JSON.parse(raw) : {};
        if (!alive) return;
        const today = todayKey();
        if (saved.onboardingDone) setOnboardingDone(true);
        if (saved.settings) setSettings({ ...DEFAULT_SETTINGS, ...saved.settings });
        const sBody = { ...DEFAULT_BODY, ...(saved.body || {}) };
        if (sBody.day !== today) {
          sBody.water = 0;
          sBody.meds = false;
          sBody.day = today;
        }
        setBodyState(sBody);
        if (saved.progress) {
          const p = { ...DEFAULT_PROGRESS, ...saved.progress };
          if (p.day !== today) {
            const gap = dayDiff(p.day, today);
            const kept = p.done > 0 && gap === 1 ? p.streak : p.done > 0 && gap === 0 ? p.streak : gap !== null && gap > 1 ? 0 : p.streak;
            setProgress({ done: 0, total: p.total, streak: kept, day: today, lastDoneDay: p.day });
          } else {
            setProgress(p);
          }
        } else {
          setProgress({ ...DEFAULT_PROGRESS, day: today });
        }
        if (saved.currentStep) setCurrentStepState(saved.currentStep);
        if (typeof saved.bodyDouble === 'boolean') setBodyDouble(saved.bodyDouble);
        if (typeof saved.events === 'number') setEvents(saved.events);
      } catch (e) {
        // fall through to defaults
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ---------- persist local state ----------
  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(
      KEY,
      JSON.stringify({
        onboardingDone,
        settings,
        body,
        progress,
        currentStep,
        bodyDouble,
        events,
      })
    ).catch(() => {});
  }, [ready, onboardingDone, settings, body, progress, currentStep, bodyDouble, events]);

  // ---------- remote records ----------
  const reload = useCallback(async () => {
    try {
      const [t, p, r] = await Promise.all([
        listRecords('tasks'),
        listRecords('parked'),
        listRecords('routines'),
      ]);
      setTasks((t || []).map(normalizeTask));
      setParked((p || []).map((x) => ({ id: String(x.id), text: x.text || '' })));
      setRoutines((r || []).map(normalizeRoutine));
    } catch (e) {
      // keep whatever is in memory; screens still render
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    reload();
  }, [ready, reload]);

  // ---------- auth ----------
  useEffect(() => {
    let alive = true;
    currentUser()
      .then((u) => {
        if (alive) setUser(u ? { email: u.email, name: u.name, id: u.id } : null);
      })
      .catch(() => {
        if (alive) setUser(null);
      });
    const off = onAuthChange((u) => {
      if (!alive) return;
      setUser(u ? { email: u.email, name: u.name, id: u.id } : null);
      setTasks([]);
      setParked([]);
      setRoutines([]);
      reload();
    });
    return () => {
      alive = false;
      if (typeof off === 'function') off();
    };
  }, [reload]);

  const signIn = useCallback(async ({ email, password }) => {
    const u = await authSignIn({ email, password });
    setUser(u ? { email: u.email, name: u.name, id: u.id } : null);
    return u;
  }, []);

  const signUp = useCallback(async ({ email, password, name }) => {
    const u = await authSignUp({ email, password, name });
    setUser(u ? { email: u.email, name: u.name, id: u.id } : null);
    return u;
  }, []);

  const signOut = useCallback(async () => {
    await authSignOut();
    setUser(null);
  }, []);

  const completeOnboarding = useCallback(async () => {
    setOnboardingDone(true);
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const saved = raw ? JSON.parse(raw) : {};
      await AsyncStorage.setItem(KEY, JSON.stringify({ ...saved, onboardingDone: true }));
    } catch (e) {
      // state is already updated; the effect will persist again
    }
  }, []);

  // ---------- current step ----------
  const timerRef = useRef(null);
  const running = !!currentStep?.running;
  const hasStep = !!currentStep;

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!hasStep || !running) return undefined;
    timerRef.current = setInterval(() => {
      setCurrentStepState((s) => {
        if (!s) return s;
        if (!s.running) return s;
        const next = Math.max(0, (s.remaining || 0) - 1);
        return { ...s, remaining: next, running: next > 0 };
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [hasStep, running]);

  const setCurrentStep = useCallback((step) => {
    if (!step) {
      setCurrentStepState(null);
      return;
    }
    const minutes = Math.max(1, Math.round(Number(step.minutes) || 5));
    setCurrentStepState({
      id: step.id != null ? String(step.id) : `s${Date.now()}`,
      title: step.title || 'Next step',
      minutes,
      remaining: typeof step.remaining === 'number' ? step.remaining : minutes * 60,
      running: step.running !== undefined ? !!step.running : true,
      taskId: step.taskId || null,
    });
    setProgress((p) => (p.total < p.done + 1 ? { ...p, total: p.done + 1 } : p));
  }, []);

  const completeStep = useCallback(() => {
    const step = currentStep;
    if (!step) return;
    if (step.taskId) {
      setTasks((list) => list.map((x) => (x.id === step.taskId ? { ...x, done: true } : x)));
      updateRecord('tasks', step.taskId, { done: true }).catch(() => {});
    }
    setProgress((p) => {
      const today = todayKey();
      const firstToday = p.done === 0;
      const done = p.done + 1;
      return {
        ...p,
        day: today,
        done,
        total: Math.max(p.total, done),
        streak: firstToday ? (p.streak || 0) + 1 : p.streak,
      };
    });
    setCurrentStepState(null);
  }, [currentStep]);

  const pause = useCallback(() => {
    setCurrentStepState((s) => (s ? { ...s, running: false } : s));
  }, []);

  const resume = useCallback(() => {
    setCurrentStepState((s) => (s && s.remaining > 0 ? { ...s, running: true } : s));
  }, []);

  const addMinutes = useCallback((n = 5) => {
    setCurrentStepState((s) =>
      s
        ? {
            ...s,
            minutes: s.minutes + n,
            remaining: (s.remaining || 0) + n * 60,
          }
        : s
    );
  }, []);

  const swapSmaller = useCallback(() => {
    setCurrentStepState((s) => {
      if (!s) return s;
      const minutes = Math.max(1, Math.ceil(s.minutes / 2));
      return {
        ...s,
        minutes,
        remaining: Math.min(s.remaining || minutes * 60, minutes * 60),
        title: s.title.startsWith('Just start: ') ? s.title : `Just start: ${s.title}`,
      };
    });
  }, []);

  // ---------- body ----------
  const setBody = useCallback((patch) => {
    setBodyState((b) => {
      const next = typeof patch === 'function' ? patch(b) : { ...b, ...patch };
      const water = Math.max(0, Math.min(next.waterGoal || 8, Math.round(Number(next.water) || 0)));
      const energy = Math.max(1, Math.min(5, Math.round(Number(next.energy) || 3)));
      return { ...next, water, energy, day: todayKey() };
    });
  }, []);

  // ---------- tasks ----------
  const addTask = useCallback(async ({ title, minutes }) => {
    const clean = (title || '').trim();
    if (!clean) throw new Error('Give the task a name first.');
    const mins = Math.max(1, Math.round(Number(minutes) || 10));
    const row = await saveRecord('tasks', { title: clean, minutes: mins, done: false });
    const task = normalizeTask({ ...row, title: clean, minutes: mins, done: false });
    setTasks((list) => [task, ...list]);
    return task;
  }, []);

  const toggleTask = useCallback(async (id) => {
    let nextDone = false;
    setTasks((list) =>
      list.map((x) => {
        if (x.id !== id) return x;
        nextDone = !x.done;
        return { ...x, done: nextDone };
      })
    );
    try {
      await updateRecord('tasks', id, { done: nextDone });
    } catch (e) {
      setTasks((list) => list.map((x) => (x.id === id ? { ...x, done: !nextDone } : x)));
      throw new Error(e?.message || 'Could not save that change.');
    }
  }, []);

  const removeTask = useCallback(async (id) => {
    const prev = tasks;
    setTasks((list) => list.filter((x) => x.id !== id));
    try {
      await deleteRecord('tasks', id);
    } catch (e) {
      setTasks(prev);
      throw new Error(e?.message || 'Could not delete that task.');
    }
  }, [tasks]);

  const startTask = useCallback(
    (id) => {
      const task = tasks.find((x) => x.id === id);
      if (!task) return;
      setCurrentStep({ id: `t${task.id}`, title: task.title, minutes: task.minutes, taskId: task.id });
    },
    [tasks, setCurrentStep]
  );

  // ---------- parked ----------
  const addParked = useCallback(async (text) => {
    const clean = (text || '').trim();
    if (!clean) throw new Error('Type the thought first.');
    const row = await saveRecord('parked', { text: clean });
    const item = { id: String(row.id), text: clean };
    setParked((list) => [item, ...list]);
    return item;
  }, []);

  const removeParked = useCallback(async (id) => {
    const prev = parked;
    setParked((list) => list.filter((x) => x.id !== id));
    try {
      await deleteRecord('parked', id);
    } catch (e) {
      setParked(prev);
      throw new Error(e?.message || 'Could not remove that thought.');
    }
  }, [parked]);

  const makeTask = useCallback(
    async (id) => {
      const item = parked.find((x) => x.id === id);
      if (!item) return null;
      const task = await addTask({ title: item.text, minutes: 10 });
      await removeParked(id);
      return task;
    },
    [parked, addTask, removeParked]
  );

  // ---------- routines ----------
  const addRoutine = useCallback(async ({ title, time }) => {
    const clean = (title || '').trim();
    if (!clean) throw new Error('Give the routine a name first.');
    const values = {
      title: clean,
      time: time || '08:00',
      week: emptyWeek(),
      grace_left: 2,
      reminder_on: false,
      streak: 0,
      last_check: '',
    };
    const row = await saveRecord('routines', values);
    const routine = normalizeRoutine({ ...values, id: row.id });
    setRoutines((list) => [...list, routine]);
    return routine;
  }, []);

  const persistRoutine = useCallback(async (routine) => {
    await updateRecord('routines', routine.id, {
      title: routine.title,
      time: routine.time,
      week: routine.week,
      grace_left: routine.graceLeft,
      reminder_on: routine.reminderOn,
      streak: routine.streak,
      last_check: routine.lastCheck,
    });
  }, []);

  const removeRoutine = useCallback(async (id) => {
    const target = routines.find((x) => x.id === id);
    if (target?.reminderOsId) {
      try {
        await cancelReminder(target.reminderOsId);
      } catch (e) {
        // reminder may already be gone
      }
    }
    const prev = routines;
    setRoutines((list) => list.filter((x) => x.id !== id));
    try {
      await deleteRecord('routines', id);
    } catch (e) {
      setRoutines(prev);
      throw new Error(e?.message || 'Could not delete that routine.');
    }
  }, [routines]);

  // Check in today. A missed day in between spends a grace day (streak holds) when one is left.
  const checkIn = useCallback(
    async (id) => {
      const target = routines.find((x) => x.id === id);
      if (!target) return null;
      const today = todayKey();
      if (target.lastCheck === today) return { ...target, already: true };
      const gap = target.lastCheck ? dayDiff(target.lastCheck, today) : 1;
      const week = target.week.slice();
      let streak = target.streak;
      let graceLeft = target.graceLeft;
      let graceUsed = false;
      let reset = false;
      const missed = gap !== null && gap > 1 ? gap - 1 : 0;

      const shift = (state) => {
        week.shift();
        week.push(state);
      };

      if (missed === 0) {
        streak += 1;
      } else if (missed <= graceLeft) {
        for (let i = 0; i < missed; i += 1) shift('grace');
        graceLeft -= missed;
        graceUsed = true;
        streak += 1;
      } else {
        for (let i = 0; i < Math.min(missed, 6); i += 1) shift('missed');
        streak = 1;
        reset = true;
      }
      shift('done');

      const next = { ...target, week, streak, graceLeft, lastCheck: today };
      setRoutines((list) => list.map((x) => (x.id === id ? next : x)));
      try {
        await persistRoutine(next);
      } catch (e) {
        setRoutines((list) => list.map((x) => (x.id === id ? target : x)));
        throw new Error(e?.message || 'Could not save that check-in.');
      }
      return { ...next, graceUsed, reset };
    },
    [routines, persistRoutine]
  );

  const reminderParts = (time) => {
    const [h, m] = String(time || '08:00').split(':').map((n) => parseInt(n, 10));
    return { hour: Number.isFinite(h) ? h : 8, minute: Number.isFinite(m) ? m : 0 };
  };

  const scheduleRoutine = useCallback(async (routine) => {
    const { hour, minute } = reminderParts(routine.time);
    return scheduleReminder(
      routine.title,
      'A gentle nudge for your routine. Grace days have your back.',
      { hour, minute }
    );
  }, []);

  const setReminder = useCallback(
    async (id, on) => {
      const target = routines.find((x) => x.id === id);
      if (!target) return false;
      let osId = target.reminderOsId;
      if (on) {
        const ok = await askNotificationPermission();
        if (!ok) {
          throw new Error('Notifications are off for this app. Turn them on in your phone Settings to get routine reminders.');
        }
        if (osId) {
          try {
            await cancelReminder(osId);
          } catch (e) {
            // ignore stale id
          }
        }
        osId = await scheduleRoutine(target);
      } else if (osId) {
        try {
          await cancelReminder(osId);
        } catch (e) {
          // ignore stale id
        }
        osId = null;
      }
      const next = { ...target, reminderOn: !!on, reminderOsId: osId };
      setRoutines((list) => list.map((x) => (x.id === id ? next : x)));
      try {
        await persistRoutine(next);
      } catch (e) {
        throw new Error(e?.message || 'Could not save the reminder setting.');
      }
      return true;
    },
    [routines, scheduleRoutine, persistRoutine]
  );

  const setRoutineTime = useCallback(
    async (id, time) => {
      const target = routines.find((x) => x.id === id);
      if (!target) return;
      let osId = target.reminderOsId;
      const base = { ...target, time };
      if (target.reminderOn) {
        if (osId) {
          try {
            await cancelReminder(osId);
          } catch (e) {
            // ignore stale id
          }
        }
        osId = await scheduleRoutine(base);
      }
      const next = { ...base, reminderOsId: osId };
      setRoutines((list) => list.map((x) => (x.id === id ? next : x)));
      try {
        await persistRoutine(next);
      } catch (e) {
        throw new Error(e?.message || 'Could not save the new time.');
      }
    },
    [routines, scheduleRoutine, persistRoutine]
  );

  // ---------- settings ----------
  const updateSettings = useCallback((patch) => {
    setSettings((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
  }, []);

  const scheduleDaily = useCallback(async (time) => {
    return scheduleReminder(
      'One small step',
      'Your Now card is waiting whenever you are ready.',
      { hour: time.hour, minute: time.minute }
    );
  }, []);

  const setRemindNow = useCallback(
    async (on) => {
      const current = settingsRef.current;
      if (on) {
        const ok = await askNotificationPermission();
        if (!ok) {
          throw new Error('Notifications are off for this app. Turn them on in your phone Settings, then try again.');
        }
        if (current.remindOsId) {
          try {
            await cancelReminder(current.remindOsId);
          } catch (e) {
            // ignore stale id
          }
        }
        const osId = await scheduleDaily(current.remindTime);
        setSettings((s) => ({ ...s, remindNow: true, remindOsId: osId }));
      } else {
        if (current.remindOsId) {
          try {
            await cancelReminder(current.remindOsId);
          } catch (e) {
            // ignore stale id
          }
        }
        setSettings((s) => ({ ...s, remindNow: false, remindOsId: null }));
      }
    },
    [scheduleDaily]
  );

  const setRemindTime = useCallback(
    async (time) => {
      const current = settingsRef.current;
      const nextTime = {
        hour: Math.max(0, Math.min(23, Math.round(Number(time?.hour) || 0))),
        minute: Math.max(0, Math.min(59, Math.round(Number(time?.minute) || 0))),
      };
      let osId = current.remindOsId;
      if (current.remindNow) {
        if (osId) {
          try {
            await cancelReminder(osId);
          } catch (e) {
            // ignore stale id
          }
        }
        osId = await scheduleDaily(nextTime);
      }
      setSettings((s) => ({ ...s, remindTime: nextTime, remindOsId: osId }));
    },
    [scheduleDaily]
  );

  const setAnalyticsConsent = useCallback((value) => {
    setSettings((s) => ({ ...s, analyticsConsent: !!value }));
    if (!value) setEvents(0);
  }, []);

  const trackEvent = useCallback(() => {
    if (!settingsRef.current.analyticsConsent) return;
    setEvents((n) => n + 1);
  }, []);

  // Privacy-first one-time unlock. No payment provider is connected, so the unlock is recorded on this device only.
  const purchase = useCallback(async () => {
    setSettings((s) => ({ ...s, purchased: true }));
    return true;
  }, []);

  const restorePurchase = useCallback(async () => {
    return settingsRef.current.purchased;
  }, []);

  const clearLocalData = useCallback(async () => {
    const osId = settingsRef.current.remindOsId;
    if (osId) {
      try {
        await cancelReminder(osId);
      } catch (e) {
        // ignore stale id
      }
    }
    for (const r of routines) {
      if (r.reminderOsId) {
        try {
          await cancelReminder(r.reminderOsId);
        } catch (e) {
          // ignore stale id
        }
      }
    }
    setCurrentStepState(null);
    setProgress({ ...DEFAULT_PROGRESS, day: todayKey() });
    setBodyState({ ...DEFAULT_BODY, day: todayKey() });
    setSettings((s) => ({ ...DEFAULT_SETTINGS, purchased: s.purchased }));
    setEvents(0);
    try {
      await Promise.all([
        ...tasks.map((x) => deleteRecord('tasks', x.id)),
        ...parked.map((x) => deleteRecord('parked', x.id)),
        ...routines.map((x) => deleteRecord('routines', x.id)),
      ]);
    } catch (e) {
      throw new Error(e?.message || 'Some items could not be deleted.');
    } finally {
      setTasks([]);
      setParked([]);
      setRoutines([]);
    }
  }, [tasks, parked, routines]);

  const value = useMemo(
    () => ({
      ready,
      loading,
      onboardingDone,
      completeOnboarding,
      user,
      signIn,
      signUp,
      signOut,
      currentStep,
      setCurrentStep,
      completeStep,
      pause,
      resume,
      addMinutes,
      swapSmaller,
      progress,
      body,
      setBody,
      tasks,
      addTask,
      toggleTask,
      removeTask,
      startTask,
      parked,
      addParked,
      removeParked,
      makeTask,
      routines,
      addRoutine,
      removeRoutine,
      checkIn,
      setRoutineTime,
      setReminder,
      settings,
      updateSettings,
      setRemindNow,
      setRemindTime,
      setAnalyticsConsent,
      purchase,
      restorePurchase,
      trackEvent,
      bodyDouble,
      setBodyDouble,
      clearLocalData,
      reload,
    }),
    [
      ready,
      loading,
      onboardingDone,
      completeOnboarding,
      user,
      signIn,
      signUp,
      signOut,
      currentStep,
      setCurrentStep,
      completeStep,
      pause,
      resume,
      addMinutes,
      swapSmaller,
      progress,
      body,
      setBody,
      tasks,
      addTask,
      toggleTask,
      removeTask,
      startTask,
      parked,
      addParked,
      removeParked,
      makeTask,
      routines,
      addRoutine,
      removeRoutine,
      checkIn,
      setRoutineTime,
      setReminder,
      settings,
      updateSettings,
      setRemindNow,
      setRemindTime,
      setAnalyticsConsent,
      purchase,
      restorePurchase,
      trackEvent,
      bodyDouble,
      clearLocalData,
      reload,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  return useContext(StoreContext);
}
