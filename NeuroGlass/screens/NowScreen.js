import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal, TextInput, Alert, Share, Dimensions, Keyboard,
  KeyboardAvoidingView, Platform, PanResponder, StatusBar, StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../ui/theme';
import { useStore } from '../store/StoreContext';
import GlassCard from '../components/GlassCard';
import GlassButton from '../components/GlassButton';
import GlassBackground from '../components/GlassBackground';
import TimerText from '../components/TimerText';
import StatusChip from '../components/StatusChip';

const ENERGY = ['Very low', 'Low', 'Medium', 'High', 'Very high'];
const MOODS = ['Calm', 'Okay', 'Tired', 'Anxious', 'Happy'];
const GUTTER = 20;
const GAP = 12;

const pad = (n) => String(n).padStart(2, '0');

function Ring({ value, size, color, track }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeLinecap="round" strokeDasharray={`${c * v} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

function medsInfo(meds) {
  if (!meds || meds === true) return 'Vyvanse 40 mg at 12:00, in 1h 18m';
  let label = '';
  let time = '';
  if (typeof meds === 'string') label = meds;
  else {
    const first = Array.isArray(meds) ? meds[0] : meds;
    if (typeof first === 'string') label = first;
    else if (first) {
      time = first.time || '';
      label = [first.name || first.title, first.dose].filter(Boolean).join(' ');
      if (time) label += ` at ${time}`;
    }
  }
  if (!label) return 'Vyvanse 40 mg at 12:00, in 1h 18m';
  const m = /(\d{1,2}):(\d{2})/.exec(time || label);
  if (m && !/, in /.test(label)) {
    const now = new Date();
    const due = new Date();
    due.setHours(Number(m[1]), Number(m[2]), 0, 0);
    const mins = Math.round((due - now) / 60000);
    if (mins > 0) {
      const h = Math.floor(mins / 60);
      label += `, in ${h > 0 ? `${h}h ` : ''}${mins % 60}m`;
    }
  }
  return label;
}

export default function NowScreen() {
  const t = useTheme();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const store = useStore() || {};
  const {
    currentStep: storeStep = null, progress = {}, body = {}, tasks = [], parked: storeParked = [],
    settings = {}, bodyDouble = null,
  } = store;
  // Spec seed: when the store holds no step yet, show the designed first step.
  const SEED_STEPS = [
    { title: "Reply to Dr. Patel's office about Thursday's appointment", minutes: 10, remaining: 6 * 60 + 42 },
    { title: 'Shower and get dressed', minutes: 15, remaining: 15 * 60 },
    { title: 'Eat lunch - leftover chicken curry and rice', minutes: 30, remaining: 30 * 60 },
  ];
  const SMALLER = [
    { title: 'Open the email and read the last message', minutes: 5 },
    { title: 'Write one line back', minutes: 3 },
    { title: 'Open the email', minutes: 2 },
  ];
  const [seedDismissed, setSeedDismissed] = useState(false);
  const [seed, setSeed] = useState({
    index: 0, done: 4, running: false, title: SEED_STEPS[0].title, minutes: SEED_STEPS[0].minutes,
    remaining: SEED_STEPS[0].remaining, swaps: 0,
  });
  const currentStep = storeStep || (seedDismissed || (tasks || []).length > 0 ? null : {
    id: `seed-step-${seed.index}-${seed.swaps}`, title: seed.title,
    minutes: seed.minutes, remaining: seed.remaining, running: seed.running, seeded: true,
  });
  const parked = (storeParked && storeParked.length > 0) ? storeParked : (seedDismissed || storeStep || (tasks || []).length > 0 ? [] : [
    { id: 'p1', text: 'oat milk' }, { id: 'p2', text: 'Sam about Saturday' }, { id: 'p3', text: 'library books' },
  ]);
  const H = Dimensions.get('window').height;

  const [secs, setSecs] = useState(currentStep?.remaining ?? 0);
  const [bodyOver, setBodyOver] = useState({});
  const [stepper, setStepper] = useState(null);
  const [parkOpen, setParkOpen] = useState(false);
  const [parkText, setParkText] = useState('');
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const running = !!currentStep?.running;
  useEffect(() => { setSecs(currentStep?.remaining ?? 0); }, [currentStep?.id, currentStep?.remaining]);
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setSecs((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [running, currentStep?.id]);
  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  const b = { water: 0, waterGoal: 8, energy: 3, mood: 'Calm', ...body, ...bodyOver };
  const setBody = (patch) => {
    setBodyOver((o) => ({ ...o, ...patch }));
    if (typeof store.setBody === 'function') store.setBody({ ...patch });
    else if (typeof store.updateBody === 'function') store.updateBody({ ...patch });
  };

  const showToast = (m) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1000);
  };

  const onDone = () => {
    Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success).catch?.(() => {});
    if (currentStep?.seeded) {
      const nextIndex = seed.index + 1;
      if (nextIndex >= SEED_STEPS.length) {
        setSeedDismissed(true);
      } else {
        const n = SEED_STEPS[nextIndex];
        setSeed({ index: nextIndex, done: seed.done + 1, running: false, title: n.title, minutes: n.minutes, remaining: n.remaining, swaps: 0 });
      }
    } else store.completeStep?.();
    showToast('Nicely done');
  };
  const onPause = () => {
    if (currentStep?.seeded) {
      setSeed((s) => ({ ...s, running: !s.running, remaining: secs }));
    } else if (running) store.pause?.(); else store.resume?.();
    Haptics.selectionAsync().catch(() => {});
  };
  const onAdd5 = () => {
    if (currentStep?.seeded) {
      setSeed((s) => ({ ...s, remaining: secs + 300, minutes: s.minutes + 5 }));
    } else store.addMinutes?.(5);
    setSecs((s) => s + 300);
    showToast('+5 min added');
  };
  const onSwap = () => {
    if (currentStep?.seeded) {
      const pick = SMALLER[Math.min(seed.swaps, SMALLER.length - 1)];
      setSeed((s) => ({ ...s, title: pick.title, minutes: pick.minutes, remaining: pick.minutes * 60, swaps: s.swaps + 1 }));
      setSecs(pick.minutes * 60);
    } else store.swapSmaller?.();
    Haptics.selectionAsync().catch(() => {});
  };
  const savePark = () => {
    const v = parkText.trim();
    if (!v) { Alert.alert('Write something first', 'Type a thought to park it.'); return; }
    store.addParked?.(v);
    setParkText('');
    setParkOpen(false);
    showToast('Parked');
  };
  const bodyDoubleText = typeof bodyDouble === 'string'
    ? bodyDouble
    : bodyDouble?.name ? `Body-double with ${bodyDouble.name} at ${bodyDouble.time || '14:00'}` : 'Body-double with Jess at 14:00';
  const onBodyDouble = () => {
    Alert.alert('Add to calendar', bodyDoubleText, [
      { text: 'Not now', style: 'cancel' },
      { text: 'Add to calendar', onPress: () => { Share.share({ message: bodyDoubleText }).catch(() => Alert.alert('Could not share', 'Try again in a moment.')); } },
    ]);
  };

  const upNext = useMemo(() => {
    if (!(tasks || []).length && currentStep?.seeded) {
      return [
        { id: 'u1', time: '10:30', title: 'Shower and get dressed', minutes: 15 },
        { id: 'u2', time: '11:00', title: 'Eat lunch - leftover chicken curry and rice', minutes: 30 },
      ];
    }
    const list = (tasks || []).filter((x) => x && !x.done && x.id !== currentStep?.id).slice(0, 2);
    const d = new Date();
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
    let cur = d.getTime();
    return list.map((x) => {
      const dt = new Date(cur);
      cur += (x.minutes || 5) * 60000;
      return { id: x.id, time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`, title: x.title, minutes: x.minutes };
    });
  }, [tasks, currentStep?.id]);

  const total = (currentStep?.minutes || 0) * 60;
  const ringValue = total > 0 ? secs / total : 0;
  const text = { color: t.text };
  const muted = { color: t.textMuted };

  const dragTools = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderRelease: (_, g) => { if (g.dy < -20 || Math.abs(g.dx) < 5) setToolsOpen(true); },
  })).current;

  const tools = [
    { name: 'Tasks', icon: 'list-outline', route: 'Tasks' },
    { name: 'Break it down', icon: 'git-branch-outline', route: 'Break it down' },
    { name: 'Routines', icon: 'repeat-outline', route: 'Routines' },
    { name: 'Settings', icon: 'settings-outline', route: 'Settings' },
  ];
  const go = (route) => { setToolsOpen(false); nav.navigate(route); };

  const chipText = (label, value) => (
    <View>
      <Text style={[t.font.caption, { fontSize: 13, lineHeight: 17 }, muted]}>{label}</Text>
      <Text style={[t.font.label, { fontSize: 15, lineHeight: 20 }, text]}>{value}</Text>
    </View>
  );

  return (
    <GlassBackground frozen={!!settings.reduceMotion}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: GUTTER, paddingBottom: 190 + insets.bottom, gap: GAP }}
        showsVerticalScrollIndicator={false}
      >
        <GlassCard padding={16} style={{ minHeight: H * 0.4, alignItems: 'center', justifyContent: 'center' }}>
          {currentStep ? (
            <>
              <View style={{ width: 300, height: 300, alignItems: 'center', justifyContent: 'center' }}>
                <Ring value={ringValue > 0 ? ringValue : 0.58} size={300} color={t.accent} track="rgba(255,255,255,0.18)" />
                <View style={{ width: 240, alignItems: 'center', justifyContent: 'center' }}>
                  <TimerText seconds={secs} size={96} color={t.text} />
                </View>
              </View>
              <Text style={[t.font.title, { fontSize: 22, lineHeight: 29, textAlign: 'center', marginTop: GAP }, text]}>
                {currentStep.title}
              </Text>
              <View style={{ marginTop: 8, paddingHorizontal: 12, minHeight: 28, justifyContent: 'center', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' }}>
                <Text style={[t.font.label, { fontSize: 13, lineHeight: 17 }, muted]}>{currentStep.minutes} min</Text>
              </View>
            </>
          ) : (
            <>
              <Text style={[t.font.title, { fontSize: 28, lineHeight: 36, textAlign: 'center' }, text]}>How's your energy?</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
                {ENERGY.map((e, i) => (
                  <Pressable
                    key={e}
                    accessibilityLabel={`Energy ${i + 1}: ${e}`}
                    onPress={() => { setBody({ energy: i + 1 }); Haptics.selectionAsync().catch(() => {}); }}
                    style={({ pressed }) => ({
                      width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: b.energy === i + 1 ? t.accent : 'rgba(255,255,255,0.16)', opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={[t.font.heading, { fontSize: 20, lineHeight: 26 }, { color: b.energy === i + 1 ? t.onAccent : t.text }]}>{i + 1}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[t.font.body, { fontSize: 15, lineHeight: 20, marginTop: 12 }, muted]}>{ENERGY[(b.energy || 3) - 1]} · pick a task from Tasks to begin</Text>
            </>
          )}
        </GlassCard>

        <GlassCard padding={16} onPress={() => nav.navigate('Tasks')}>
          <Text style={[t.font.body, { fontSize: 16, lineHeight: 22 }, muted]}>Next</Text>
          {upNext.length === 0 ? (
            <Text style={[t.font.body, { fontSize: 15, lineHeight: 22, marginTop: 8 }, muted]}>Nothing waiting. Enjoy the quiet.</Text>
          ) : upNext.map((u) => (
            <View key={u.id} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
              <Text style={[t.font.label, { fontSize: 15, lineHeight: 20, width: 52 }, muted]}>{u.time}</Text>
              <Text style={[t.font.body, { fontSize: 15, lineHeight: 20, flex: 1 }, text]}>{u.title}</Text>
              <Text style={[t.font.body, { fontSize: 13, lineHeight: 20, marginLeft: 8, textAlign: 'right' }, muted]}>{u.minutes} min</Text>
            </View>
          ))}
        </GlassCard>

        <GlassCard padding={12}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Meds: ${medsInfo(b.meds)}`} onPress={() => { setBody({ meds: true }); Haptics.selectionAsync().catch(() => {}); showToast('Meds noted'); }} style={({ pressed }) => [styles.chip, { flex: 1.4, opacity: pressed ? 0.7 : 1 }]}>
              {chipText('Meds', medsInfo(b.meds))}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Water ${b.water} of ${b.waterGoal}`} onPress={() => setStepper('water')} style={({ pressed }) => [styles.chip, { flex: 1, opacity: pressed ? 0.7 : 1 }]}>
              {chipText('Water', `${b.water} of ${b.waterGoal}`)}
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Energy ${ENERGY[(b.energy || 3) - 1]} ${b.energy}/5`} onPress={() => setStepper('energy')} style={({ pressed }) => [styles.chip, { flex: 1, opacity: pressed ? 0.7 : 1 }]}>
              {chipText('Energy', `${ENERGY[(b.energy || 3) - 1]} ${b.energy}/5`)}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Mood ${b.mood}`} onPress={() => setStepper('mood')} style={({ pressed }) => [styles.chip, { flex: 1, opacity: pressed ? 0.7 : 1 }]}>
              {chipText('Mood', b.mood)}
            </Pressable>
          </View>
        </GlassCard>

        <GlassCard padding={16}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Text style={[t.font.body, { fontSize: 15, lineHeight: 21, flex: 1 }, text]}>
              {(parked || []).length === 0 ? 'Nothing parked yet.' : `Parked: ${parked.map((p) => p?.text).filter(Boolean).join(', ')}`}
            </Text>
            <Pressable onPress={() => nav.navigate('Tasks')} hitSlop={12} style={{ minHeight: 28, marginLeft: 8 }}>
              <Text style={[t.font.label, { fontSize: 15, lineHeight: 21, color: t.accentSoft }]}>View</Text>
            </Pressable>
          </View>
          <Text style={[t.font.body, { fontSize: 13, lineHeight: 18, marginTop: 8 }, muted]}>
            {`${currentStep?.seeded ? seed.done : (progress.done || 4)} of ${progress.total || 9} steps  ·  ${progress.streak || 2}-day streak`}
          </Text>
          <Pressable onPress={onBodyDouble} style={{ minHeight: 32, justifyContent: 'center' }}>
            <Text style={[t.font.body, { fontSize: 13, lineHeight: 18 }, muted]}>{bodyDoubleText}</Text>
          </Pressable>
        </GlassCard>
      </ScrollView>

      {toast ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 12, alignSelf: 'center', paddingHorizontal: 16, height: 40, borderRadius: 20, justifyContent: 'center', backgroundColor: t.accent }}>
          <Text style={[t.font.label, { fontSize: 15, lineHeight: 20, color: t.onAccent }]}>{toast}</Text>
        </View>
      ) : null}

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: insets.bottom + 6, backgroundColor: 'rgba(30,58,68,0.78)', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.3)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={onPause} onLongPress={onAdd5} delayLongPress={450}
            accessibilityLabel={running ? 'Pause' : 'Resume'}
            style={({ pressed }) => [styles.small, { opacity: pressed ? 0.7 : 1, opacity2: 1 }]}
          >
            <Ionicons name={running ? 'pause' : 'play'} size={20} color={t.text} />
            <Text style={[t.font.caption, { fontSize: 11, lineHeight: 14 }, text]}>{running ? 'Pause' : 'Resume'}</Text>
            <Text style={[t.font.caption, { fontSize: 11, lineHeight: 14 }, muted]}>hold +5 min</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <GlassButton label="Done" onPress={onDone} height={64} radius={32} disabled={!currentStep} />
          </View>
          <Pressable onPress={onSwap} accessibilityLabel="Swap smaller" disabled={!currentStep} style={({ pressed }) => [styles.small, { opacity: !currentStep ? 0.4 : pressed ? 0.7 : 1 }]}>
            <Ionicons name="swap-horizontal" size={20} color={t.text} />
            <Text style={[t.font.caption, { fontSize: 11, lineHeight: 14 }, text]}>Swap</Text>
            <Text style={[t.font.caption, { fontSize: 11, lineHeight: 14 }, muted]}>smaller</Text>
          </Pressable>
          <Pressable onPress={() => setParkOpen(true)} accessibilityLabel="Park thought" style={({ pressed }) => [styles.small, { opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="add" size={22} color={t.text} />
            <Text style={[t.font.caption, { fontSize: 11, lineHeight: 14 }, text]}>Park</Text>
            <Text style={[t.font.caption, { fontSize: 11, lineHeight: 14 }, muted]}>thought</Text>
          </Pressable>
        </View>
        <View {...dragTools.panHandlers} style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="More tools">
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.45)' }} />
          <Text style={[t.font.caption, { fontSize: 13, lineHeight: 17, marginTop: 4 }, muted]}>More tools</Text>
        </View>
      </View>

      <Modal visible={!!stepper} transparent animationType="fade" onRequestClose={() => setStepper(null)}>
        <Pressable style={styles.scrim} onPress={() => setStepper(null)}>
          <Pressable accessible={false} style={[styles.sheet, { backgroundColor: t.bg, paddingBottom: insets.bottom + 20 }]} onPress={Keyboard.dismiss}>
            {stepper === 'water' ? (
              <>
                <Text style={[t.font.heading, { fontSize: 20, lineHeight: 26 }, text]}>Water</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginVertical: 20 }}>
                  <Pressable accessibilityLabel="Less water" onPress={() => setBody({ water: Math.max(0, (b.water || 0) - 1) })} style={styles.round}>
                    <Ionicons name="remove" size={26} color={t.text} />
                  </Pressable>
                  <Text style={[t.font.title, { fontSize: 28, lineHeight: 36 }, text]}>{b.water} of {b.waterGoal}</Text>
                  <Pressable accessibilityLabel="More water" onPress={() => setBody({ water: Math.min(b.waterGoal || 8, (b.water || 0) + 1) })} style={[styles.round, { backgroundColor: t.accent }]}>
                    <Ionicons name="add" size={26} color={t.onAccent} />
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={[t.font.heading, { fontSize: 20, lineHeight: 26 }, text]}>{stepper === 'energy' ? 'Energy' : 'Mood'}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 20 }}>
                  {(stepper === 'energy' ? ENERGY : MOODS).map((o, i) => {
                    const on = stepper === 'energy' ? b.energy === i + 1 : b.mood === o;
                    return (
                      <Pressable
                        key={o}
                        onPress={() => { setBody(stepper === 'energy' ? { energy: i + 1 } : { mood: o }); Haptics.selectionAsync().catch(() => {}); setStepper(null); }}
                        style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: 'center', backgroundColor: on ? t.accent : 'rgba(255,255,255,0.14)' }}
                      >
                        <Text style={[t.font.label, { fontSize: 15, lineHeight: 20, color: on ? t.onAccent : t.text }]}>{stepper === 'energy' ? `${i + 1} · ${o}` : o}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
            <GlassButton label="Done" variant="secondary" height={50} radius={25} onPress={() => setStepper(null)} />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={parkOpen} transparent animationType="slide" onRequestClose={() => setParkOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={styles.scrim} onPress={() => setParkOpen(false)}>
            <Pressable accessible={false} style={[styles.sheet, { backgroundColor: t.bg, paddingBottom: insets.bottom + 20 }]} onPress={Keyboard.dismiss}>
              <Text style={[t.font.heading, { fontSize: 20, lineHeight: 26, marginBottom: 12 }, text]}>Park a thought</Text>
              <TextInput
                value={parkText} onChangeText={setParkText} autoFocus returnKeyType="done" onSubmitEditing={savePark}
                placeholder="What's on your mind?" placeholderTextColor={t.textMuted}
                style={[t.font.body, { fontSize: 17, minHeight: 56, borderRadius: 16, paddingHorizontal: 16, color: t.text, backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 12 }]}
              />
              <GlassButton label="Save" onPress={savePark} height={56} radius={28} />
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={toolsOpen} transparent animationType="slide" onRequestClose={() => setToolsOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setToolsOpen(false)}>
          <Pressable accessible={false} style={[styles.sheet, { backgroundColor: t.bg, paddingBottom: insets.bottom + 20 }]} onPress={Keyboard.dismiss}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.45)', marginBottom: 12 }} />
            <Text style={[t.font.heading, { fontSize: 20, lineHeight: 26, marginBottom: 8 }, text]}>More tools</Text>
            {tools.map((x) => (
              <Pressable key={x.name} onPress={() => go(x.route)} style={({ pressed }) => ({ minHeight: 56, flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.6 : 1 })}>
                <Ionicons name={x.icon} size={22} color={t.accentSoft} />
                <Text style={[t.font.body, { fontSize: 17, lineHeight: 24, flex: 1, marginLeft: 12 }, text]}>{x.name}</Text>
                <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 56, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.3)',
  },
  small: {
    width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.3)',
  },
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  round: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
});
