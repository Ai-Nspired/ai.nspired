import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ui/theme';
import { FadeInView, RingProgress, pct } from '../ui/kit';
import ToolFrame from '../components/ToolFrame';
import { Card, Btn, SectionLabel, ErrorNote, usePalette, success, tick } from '../components/Controls';
import { TOOLS } from '../constants/tools';
import { usePrefs } from '../store/PrefsContext';
import { saveRecord, listRecords, updateRecord, deleteRecord, syncPending } from '../lib/wron-db';
import { onAuthChange } from '../lib/wron-auth';
import { breakDown } from '../lib/ai';

const TOOL = TOOLS[3];
const TABLE = 'focus_tasks';

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function TaskmasterScreen() {
  const t = useTheme();
  const { blue, strong } = usePalette();
  const { language, spice } = usePrefs();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [rot, setRot] = useState({});
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [secs, setSecs] = useState(0);
  const [running, setRunning] = useState(true);

  const load = useCallback(async () => {
    try {
      const rows = await listRecords(TABLE, { orderBy: 'created_at', descending: false });
      setTasks((rows || []).map((r) => ({ id: String(r.id), title: r.title || '', done: !!r.done })));
      setLoadError('');
    } catch (e) {
      setLoadError((e && e.message) || 'Could not load your tasks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const off = onAuthChange(async (u) => {
      if (!alive) return;
      try {
        if (u) await syncPending();
      } catch (e) {
        // load whatever is available
      }
      if (alive) load();
    });
    return () => {
      alive = false;
      if (typeof off === 'function') off();
    };
  }, [load]);

  const open = useMemo(
    () => tasks.filter((x) => !x.done).sort((a, b) => (rot[a.id] || 0) - (rot[b.id] || 0)),
    [tasks, rot]
  );
  const done = useMemo(() => tasks.filter((x) => x.done), [tasks]);
  const current = open[0] || null;
  const currentId = current ? current.id : null;

  useEffect(() => {
    setSecs(0);
    setRunning(true);
  }, [currentId]);

  useEffect(() => {
    if (!running || !currentId) return undefined;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running, currentId]);

  const add = async () => {
    const v = text.trim();
    if (!v) {
      Alert.alert('Add a task first', 'Type what you need to do, then tap Add.');
      return;
    }
    tick();
    setText('');
    try {
      const row = await saveRecord(TABLE, { title: v, done: false });
      setTasks((l) => [...l, { id: String(row.id), title: v, done: false }]);
    } catch (e) {
      setText(v);
      Alert.alert('Could not add the task', (e && e.message) || 'Please try again.');
    }
  };

  const setDone = async (task, value) => {
    setTasks((l) => l.map((x) => (x.id === task.id ? { ...x, done: value } : x)));
    try {
      await updateRecord(TABLE, task.id, { done: value });
      if (value) success();
    } catch (e) {
      setTasks((l) => l.map((x) => (x.id === task.id ? { ...x, done: !value } : x)));
      Alert.alert('Could not save that', (e && e.message) || 'Please try again.');
    }
  };

  const skip = () => {
    if (!current) return;
    tick();
    setRot((r) => ({ ...r, [current.id]: Date.now() }));
  };

  const split = async () => {
    if (!current) return;
    const target = current;
    setBusy(true);
    try {
      const steps = await breakDown({ task: target.title, spice: Math.min(spice, 3), language, listName: '' });
      if (!steps.length) throw new Error('No steps came back. Try again.');
      const created = [];
      for (const s of steps) {
        const row = await saveRecord(TABLE, { title: s, done: false });
        created.push({ id: String(row.id), title: s, done: false });
      }
      await deleteRecord(TABLE, target.id);
      setTasks((l) => [...l.filter((x) => x.id !== target.id), ...created]);
      setRot((r) => {
        const n = { ...r };
        created.forEach((c, i) => { n[c.id] = -1e13 + i; });
        return n;
      });
      success();
    } catch (e) {
      Alert.alert('Could not break that down', (e && e.message) || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = (task) => {
    Alert.alert('Delete this task?', `"${task.title}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const before = tasks;
          setTasks((l) => l.filter((x) => x.id !== task.id));
          try {
            await deleteRecord(TABLE, task.id);
          } catch (e) {
            setTasks(before);
            Alert.alert('Could not delete', (e && e.message) || 'Please try again.');
          }
        },
      },
    ]);
  };

  const clearDone = () => {
    if (done.length === 0) return;
    Alert.alert('Clear finished tasks?', `${done.length} finished task${done.length === 1 ? '' : 's'} will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          const before = tasks;
          setTasks((l) => l.filter((x) => !x.done));
          try {
            await Promise.all(done.map((x) => deleteRecord(TABLE, x.id)));
          } catch (e) {
            setTasks(before);
            Alert.alert('Could not clear', (e && e.message) || 'Please try again.');
          }
        },
      },
    ]);
  };

  const total = tasks.length;
  const progress = pct(done.length, total) / 100;

  const footer = (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Add a task…"
        placeholderTextColor={t.textMuted}
        returnKeyType="done"
        onSubmitEditing={add}
        style={[t.font.body, { flex: 1, height: 52, borderRadius: 16, paddingHorizontal: 16, color: t.text, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border }]}
      />
      <Pressable
        onPress={add}
        accessibilityRole="button"
        accessibilityLabel="Add task"
        style={({ pressed }) => ({ width: 52, height: 52, borderRadius: 16, marginLeft: 8, backgroundColor: blue, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </Pressable>
    </View>
  );

  return (
    <ToolFrame title={TOOL.title} subtitle={TOOL.subtitle} help={TOOL.help} footer={footer}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={t.accent} />
      ) : (
        <>
          {total > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <RingProgress size={56} stroke={7} value={progress} color={strong}>
                <Text style={[t.font.caption, { color: t.text }]}>{`${Math.round(progress * 100)}%`}</Text>
              </RingProgress>
              <Text style={[t.font.subhead, { color: t.textMuted, marginLeft: 12 }]}>{`${done.length} done · ${open.length} to go`}</Text>
            </View>
          ) : null}

          {current ? (
            <FadeInView key={current.id}>
              <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
                <Text style={[t.font.label, { color: t.textMuted }]}>Right now, just this</Text>
                <Text style={[t.font.title, { color: t.text, textAlign: 'center', marginTop: 12 }]}>{current.title}</Text>
                <Pressable
                  onPress={() => { tick(); setRunning((r) => !r); }}
                  accessibilityRole="button"
                  accessibilityLabel={running ? 'Pause the timer' : 'Resume the timer'}
                  style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, marginTop: 12 }}
                >
                  <Ionicons name={running ? 'pause-circle-outline' : 'play-circle-outline'} size={22} color={t.textMuted} />
                  <Text style={[t.font.body, { color: t.textMuted, marginLeft: 6, fontVariant: ['tabular-nums'] }]}>{fmt(secs)}</Text>
                </Pressable>
                <Btn title="Done" icon="checkmark-circle" onPress={() => setDone(current, true)} height={56} style={{ alignSelf: 'stretch', marginTop: 12 }} />
                <View style={{ flexDirection: 'row', alignSelf: 'stretch', marginTop: 10 }}>
                  <Btn title="Not now" icon="return-down-forward" variant="secondary" onPress={skip} disabled={open.length < 2} height={46} style={{ flex: 1, marginRight: 8 }} />
                  <Btn title="Too big" icon="color-wand" variant="secondary" onPress={split} loading={busy} height={46} style={{ flex: 1 }} />
                </View>
              </Card>
              <Text style={[t.font.footnote, { color: t.textMuted, textAlign: 'center', marginTop: 10 }]}>
                {open.length > 1 ? `${open.length - 1} more waiting out of sight.` : 'This is the last one.'}
              </Text>
            </FadeInView>
          ) : (
            <View style={{ alignItems: 'center', paddingTop: 16, paddingHorizontal: 12 }}>
              <View style={{ width: 84, height: 84, borderRadius: 28, backgroundColor: TOOL.color + '2A', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={total > 0 ? 'happy-outline' : 'play-skip-forward-circle-outline'} size={44} color={TOOL.color} />
              </View>
              <Text style={[t.font.heading, { color: t.text, marginTop: 16, textAlign: 'center' }]}>
                {total > 0 ? 'All done. Nice work.' : 'Nothing on your plate'}
              </Text>
              <Text style={[t.font.callout, { color: t.textMuted, textAlign: 'center', marginTop: 8 }]}>
                {total > 0
                  ? 'Everything is finished. Add something new below whenever you are ready.'
                  : 'Add everything on your mind below. Taskmaster will show you only one thing at a time.'}
              </Text>
            </View>
          )}

          <ErrorNote message={loadError} onRetry={load} />

          {done.length > 0 ? (
            <View style={{ marginTop: 24 }}>
              <Pressable
                onPress={() => { tick(); setShowDone((s) => !s); }}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}
              >
                <SectionLabel style={{ marginBottom: 0, flex: 1 }}>{`Finished (${done.length})`}</SectionLabel>
                <Ionicons name={showDone ? 'chevron-up' : 'chevron-down'} size={18} color={t.textMuted} />
              </Pressable>
              {showDone ? (
                <View>
                  {done.map((x) => (
                    <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, borderBottomWidth: 1, borderBottomColor: t.border }}>
                      <Pressable onPress={() => setDone(x, false)} accessibilityRole="button" accessibilityLabel={`Mark ${x.title} as not done`} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="checkmark-circle" size={26} color={strong} />
                      </Pressable>
                      <Text style={[t.font.body, { color: t.textMuted, flex: 1, textDecorationLine: 'line-through' }]}>{x.title}</Text>
                      <Pressable onPress={() => remove(x)} accessibilityRole="button" accessibilityLabel={`Delete ${x.title}`} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="trash-outline" size={20} color={t.textMuted} />
                      </Pressable>
                    </View>
                  ))}
                  <Btn title="Clear finished" variant="danger" onPress={clearDone} height={44} style={{ marginTop: 12 }} />
                </View>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </ToolFrame>
  );
}
