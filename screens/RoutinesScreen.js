import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../ui/theme';
import { useStore } from '../store/StoreContext';
import GlassBackground from '../components/GlassBackground';
import GlassHeader from '../components/GlassHeader';
import GlassCard from '../components/GlassCard';
import GlassButton from '../components/GlassButton';
import PipRow from '../components/PipRow';
import RoutineSheet from '../components/Routines/RoutineSheet';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const weekOf = (r) => {
  const w = r?.week || r?.pips;
  return Array.isArray(w) && w.length === 7 ? w : ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'];
};

export default function RoutinesScreen() {
  const t = useTheme();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const store = useStore() || {};
  const routines = Array.isArray(store.routines) ? store.routines : [];
  const settings = store.settings || {};
  const [editing, setEditing] = useState(null);
  const [fresh, setFresh] = useState(false);

  const summary = useMemo(() => {
    const streak = routines.reduce((mx, r) => Math.max(mx, Number(r?.streak) || 0), 0);
    let graceDay = null;
    let missed = false;
    let graceLeft = 0;
    routines.forEach((r) => {
      graceLeft = Math.max(graceLeft, Number(r?.graceLeft) || 0);
      weekOf(r).forEach((p, i) => {
        if (p === 'grace' && graceDay === null) graceDay = i;
        if (p === 'missed') missed = true;
      });
    });
    return { streak, graceDay, missed, graceLeft };
  }, [routines]);

  // Grace days ran out and a day was missed: the streak has reset to 0.
  const graceExhausted = summary.missed && summary.graceLeft <= 0;
  const showFresh = fresh || graceExhausted || (summary.streak === 0 && summary.missed);

  const message = () => {
    if (showFresh) return "A fresh start. That's okay.";
    if (summary.graceDay !== null) {
      const left = summary.graceLeft;
      return `You missed ${DAYS[summary.graceDay]}. A grace day covered it, so your streak is still ${summary.streak} days. ${left} grace ${left === 1 ? 'day' : 'days'} left this week.`;
    }
    return `Check in each day to build your streak. You get 2 grace days a week.`;
  };

  const heroStreak = showFresh && graceExhausted ? 0 : summary.streak;

  const checkIn = async (r) => {
    try {
      const hadReset = summary.missed && summary.graceLeft <= 0;
      await store.checkIn?.(r.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setFresh(hadReset);
    } catch (e) {
      Alert.alert('Could not check in', e?.message || 'Please try again.');
    }
  };

  const save = async (time, on) => {
    const r = editing;
    try {
      await store.setRoutineTime?.(r.id, time);
      if ((!!r.reminderOn) !== on) await store.setReminder?.(r.id, on);
      else if (on) {
        await store.setReminder?.(r.id, false);
        await store.setReminder?.(r.id, true);
      }
      setEditing(null);
    } catch (e) {
      Alert.alert('Reminder not set', e?.message || 'Allow notifications in your phone settings, then try again.');
    }
  };

  const addRoutine = () => {
    if (typeof store.addRoutine === 'function') {
      store.addRoutine({ title: 'Morning routine', time: '08:00' });
    } else {
      Alert.alert('Add a routine', 'Routines can’t be added right now. Please try again later.');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <GlassBackground frozen={!!settings.reduceMotion}>
        <View style={{ flex: 1 }}>
          <View style={{ paddingTop: insets.top }}>
            <GlassHeader title="Routines" onBack={() => nav.goBack()} />
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 32 }}
          >
            {routines.length === 0 ? (
              <GlassCard padding={16} radius={24}>
                <Text style={[t.font.heading, { color: t.text }]}>Add a routine to start your streak.</Text>
                <Text style={[t.font.body, { color: t.textMuted, marginTop: 8, marginBottom: 16 }]}>A missed day uses a grace day instead of breaking it.</Text>
                <GlassButton label="Add a routine" onPress={addRoutine} height={50} />
              </GlassCard>
            ) : (
              <>
                <GlassCard padding={16} radius={24}>
                  <Text style={[t.font.title, { color: t.text, fontSize: 48, lineHeight: 62 }]}>{heroStreak}-day streak</Text>
                  <View style={{ marginVertical: 12 }}>
                    <PipRow pips={weekOf(routines[0])} />
                  </View>
                  <Text style={[t.font.body, { color: t.textMuted, fontSize: 16, lineHeight: 23 }]}>{message()}</Text>
                </GlassCard>
                {routines.map((r) => (
                  <GlassCard key={r.id} padding={16} radius={24} style={{ marginTop: 12 }} onPress={() => setEditing(r)}>
                    <Text style={[t.font.heading, { color: t.text }]}>{r.title}</Text>
                    <Text style={[t.font.body, { color: t.textMuted, marginTop: 2 }]}>{r.time}</Text>
                    <View style={{ marginVertical: 12 }}>
                      <PipRow pips={weekOf(r)} />
                    </View>
                    <GlassButton label="Check in" onPress={() => checkIn(r)} height={44} radius={22} />
                  </GlassCard>
                ))}
              </>
            )}
            <Text style={[t.font.label, { color: t.textMuted, marginTop: 16 }]}>You get 2 grace days a week. Using one never breaks your streak.</Text>
          </ScrollView>
        </View>
      </GlassBackground>
      <RoutineSheet routine={editing} onClose={() => setEditing(null)} onSave={save} />
    </View>
  );
}
