import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput, Alert, Animated, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../ui/theme';
import { useStore } from '../store/StoreContext';
import GlassBackground from '../components/GlassBackground';
import GlassCard from '../components/GlassCard';
import GlassButton from '../components/GlassButton';
import GlassHeader from '../components/GlassHeader';

const DURATIONS = [5, 10, 15, 20, 30, 45];
const GUTTER = 20;

// A row that fades and sinks when it is checked: it slides down and dims,
// then the list re-orders it to the bottom once the animation has played.
function SinkRow({ done, children }) {
  const a = useRef(new Animated.Value(done ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: done ? 1 : 0, duration: 420, useNativeDriver: true }).start();
  }, [done, a]);
  return (
    <Animated.View
      style={{
        opacity: a.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }),
        transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

function Segmented({ value, onChange, t }) {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const idx = value === 'today' ? 0 : 1;
  useEffect(() => {
    Animated.spring(x, { toValue: idx * (w / 2), useNativeDriver: true, friction: 8 }).start();
  }, [idx, w, x]);
  const opts = [['today', 'Today'], ['parked', 'Parked']];
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ height: 48, borderRadius: t.radius.pill, backgroundColor: 'rgba(255,255,255,0.14)', flexDirection: 'row', padding: 3 }}
    >
      {w > 0 ? (
        <Animated.View
          style={{ position: 'absolute', top: 3, left: 3, width: (w - 6) / 2, height: 42, borderRadius: t.radius.pill, backgroundColor: t.accent, transform: [{ translateX: x }] }}
        />
      ) : null}
      {opts.map(([k, label]) => (
        <Pressable
          key={k}
          accessibilityRole="button"
          onPress={() => { Haptics.selectionAsync(); onChange(k); }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={[t.font.label, { color: value === k ? t.onAccent : t.textMuted }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function TasksScreen() {
  const t = useTheme();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const store = useStore() || {};
  const tasks = store.tasks || [];
  const parked = store.parked || [];
  const settings = store.settings || {};
  const [tab, setTab] = useState('today');
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [mins, setMins] = useState(10);

  // Done rows keep their place while they fade and sink, then drop to the bottom.
  const [settled, setSettled] = useState({});
  useEffect(() => {
    const timers = tasks.filter((x) => x.done && !settled[x.id]).map((x) =>
      setTimeout(() => setSettled((s) => ({ ...s, [x.id]: true })), 450));
    return () => timers.forEach(clearTimeout);
  }, [tasks, settled]);
  useEffect(() => {
    const undone = tasks.filter((x) => !x.done && settled[x.id]);
    if (undone.length) setSettled((s) => { const n = { ...s }; undone.forEach((x) => delete n[x.id]); return n; });
  }, [tasks, settled]);
  const isSunk = (x) => x.done && settled[x.id];
  const ordered = [...tasks.filter((x) => !isSunk(x)), ...tasks.filter((x) => isSunk(x))];
  const firstOpenId = tasks.find((x) => !x.done)?.id;

  const openAdd = () => { setTitle(''); setMins(10); setAdding(true); };
  const save = () => {
    const name = title.trim();
    if (!name) { Alert.alert('Add a title first', 'Type what the task is, then save.'); return; }
    if (typeof store.addTask === 'function') {
      store.addTask({ title: name, minutes: mins });
      setAdding(false);
    } else {
      Alert.alert('Could not save', 'Tasks cannot be saved right now.');
    }
  };
  const toggle = (task) => {
    Haptics.selectionAsync();
    if (typeof store.toggleTask === 'function') store.toggleTask(task.id);
    else if (typeof store.completeTask === 'function') store.completeTask(task.id);
    else Alert.alert('Could not update', 'This task cannot be changed right now.');
  };
  const start = (task) => {
    if (typeof store.setCurrentStep === 'function') {
      store.setCurrentStep({ id: task.id, title: task.title, minutes: task.minutes, remaining: task.minutes * 60, running: true });
    }
    nav.navigate('Now');
  };
  const make = (p) => {
    if (typeof store.makeTask === 'function') {
      store.makeTask(p.id);
      setTab('today');
    } else Alert.alert('Could not move', 'This thought cannot be moved right now.');
  };

  return (
    <View style={{ flex: 1 }}>
      <GlassBackground frozen={!!settings.reduceMotion}>
        <View style={{ flex: 1 }}>
          <View style={{ paddingTop: insets.top }}>
            <GlassHeader
              title="Tasks"
              onBack={() => nav.goBack()}
              right={
                <Pressable accessibilityLabel="Add task" onPress={openAdd} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="add" size={26} color={t.text} />
                </Pressable>
              }
            />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: insets.bottom + 32 }}>
            <Segmented value={tab} onChange={setTab} t={t} />
            <View style={{ height: 12 }} />
            <GlassCard padding={8} radius={24}>
              {tab === 'today' ? (
                ordered.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={[t.font.body, { color: t.textMuted, textAlign: 'center' }]}>Nothing waiting. Enjoy the quiet.</Text>
                    <View style={{ height: 12 }} />
                    <GlassButton label="Add a task" onPress={openAdd} height={48} />
                  </View>
                ) : (
                  ordered.map((task) => (
                    <SinkRow key={task.id} done={!!task.done}>
                    <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6 }}>
                      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!task.done }} onPress={() => toggle(task)} hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: task.done ? t.accent : t.textMuted, backgroundColor: task.done ? t.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                          {task.done ? <Ionicons name="checkmark" size={16} color={t.onAccent} /> : null}
                        </View>
                      </Pressable>
                      <View style={{ flex: 1, paddingHorizontal: 4 }}>
                        <Text style={[t.font.body, { color: t.text, textDecorationLine: task.done ? 'line-through' : 'none' }]}>{task.title}</Text>
                      </View>
                      <Text style={[t.font.caption, { color: t.textMuted, marginHorizontal: 8 }]}>{task.minutes} min</Text>
                      {task.id === firstOpenId && !task.done ? (
                        <Pressable accessibilityRole="button" onPress={() => start(task)} style={{ minHeight: 44, minWidth: 64, borderRadius: t.radius.pill, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }}>
                          <Text style={[t.font.label, { color: t.onAccent }]}>Start</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    </SinkRow>
                  ))
                )
              ) : parked.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={[t.font.body, { color: t.textMuted, textAlign: 'center' }]}>Nothing parked yet.</Text>
                </View>
              ) : (
                parked.map((p) => (
                  <View key={p.id} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={[t.font.body, { color: t.text, flex: 1 }]}>{p.text}</Text>
                    <Pressable accessibilityRole="button" onPress={() => make(p)} style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 12 }}>
                      <Text style={[t.font.caption, { color: t.accentSoft }]}>Make it a task</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </GlassCard>
          </ScrollView>
        </View>
      </GlassBackground>

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View style={{ backgroundColor: t.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: GUTTER, paddingBottom: insets.bottom + 16 }}>
            <Text style={[t.font.heading, { color: t.text, marginBottom: 12 }]}>New task</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="What needs doing?"
              placeholderTextColor={t.textMuted}
              returnKeyType="done"
              onSubmitEditing={save}
              style={[t.font.body, { color: t.text, minHeight: 52, paddingHorizontal: 16, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.14)' }]}
            />
            <Text style={[t.font.label, { color: t.textMuted, marginTop: 16, marginBottom: 8 }]}>Duration</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {DURATIONS.map((d) => (
                <Pressable
                  key={d}
                  onPress={() => { Haptics.selectionAsync(); setMins(d); }}
                  style={{ minHeight: 44, minWidth: 64, borderRadius: t.radius.pill, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginBottom: 8, paddingHorizontal: 12, backgroundColor: mins === d ? t.accent : 'rgba(255,255,255,0.14)' }}
                >
                  <Text style={[t.font.label, { color: mins === d ? t.onAccent : t.text }]}>{d} min</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ height: 8 }} />
            <GlassButton label="Add task" onPress={save} height={56} disabled={!title.trim()} />
            <Pressable onPress={() => setAdding(false)} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[t.font.body, { color: t.textMuted }]}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
