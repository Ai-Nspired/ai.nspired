import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, PanResponder, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../ui/theme';
import { useStore } from '../store/StoreContext';
import GlassBackground from '../components/GlassBackground';
import GlassCard from '../components/GlassCard';
import GlassButton from '../components/GlassButton';

const ROW_H = 56;
const TINY = ['Take one slow breath', 'Stand up and walk to it', 'Put on music or a timer', 'Look at it for a moment'];

let counter = 0;
const nid = () => `bd-${Date.now()}-${counter++}`;
const mk = (title, minutes) => ({ id: nid(), title, minutes });

function generate(text) {
  const clean = (text || '').trim();
  if (!clean) return [];
  if (clean.toLowerCase() === 'clean the kitchen') {
    return [mk('Clear the sink of cups', 3), mk('Load the dishwasher', 5), mk('Wipe the counters', 4), mk('Take out the bin bag', 3), mk('Sweep the floor', 5)];
  }
  return [
    mk(`Gather what you need for: ${clean}`, 3),
    mk(`Do the first small part of: ${clean}`, 5),
    mk('Take a short break and sip some water', 3),
    mk(`Do the next part of: ${clean}`, 5),
    mk('Tidy up and check it off', 3),
  ];
}

function Step({ item, index, count, onEdit, onDelete, onMove, swiped, setSwiped, t }) {
  const [dragY, setDragY] = useState(0);
  const ref = useRef({});
  ref.current = { index, count, onMove, item };
  const drag = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => setDragY(g.dy),
    onPanResponderRelease: (_, g) => {
      setDragY(0);
      const to = Math.max(0, Math.min(ref.current.count - 1, ref.current.index + Math.round(g.dy / ROW_H)));
      if (to !== ref.current.index) { Haptics.selectionAsync(); ref.current.onMove(ref.current.index, to); }
    },
    onPanResponderTerminate: () => setDragY(0),
  })).current;
  const swipe = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
    onPanResponderRelease: (_, g) => {
      if (g.dx < -40) setSwiped(ref.current.item.id);
      else if (g.dx > 20) setSwiped(null);
    },
  })).current;
  const open = swiped === item.id;
  return (
    <View style={{ minHeight: ROW_H, zIndex: dragY ? 5 : 0, transform: [{ translateY: dragY }] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: ROW_H }} {...swipe.panHandlers}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: ROW_H, marginRight: open ? 8 : 0 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: t.textMuted, marginRight: 12 }} />
          <TextInput
            value={item.title}
            onChangeText={(v) => onEdit(item.id, v)}
            multiline
            style={[t.font.body, { flex: 1, color: t.text, fontSize: 17, lineHeight: 22, paddingVertical: 8 }]}
            accessibilityLabel={`Step ${index + 1}`}
          />
          <Text style={[t.font.caption, { color: t.textMuted, fontSize: 13, lineHeight: 17, marginHorizontal: 8 }]}>{item.minutes} min</Text>
          <View {...drag.panHandlers} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="reorder-three-outline" size={22} color={t.textMuted} />
          </View>
        </View>
        {open ? (
          <Pressable onPress={() => onDelete(item)} style={{ minWidth: 72, minHeight: 44, borderRadius: 12, backgroundColor: t.danger, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[t.font.label, { color: '#fff', fontSize: 15, lineHeight: 20 }]}>Delete</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function BreakItDownScreen() {
  const t = useTheme();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const store = useStore() || {};
  const { setCurrentStep, addTask, settings } = store;
  const [input, setInput] = useState('Clean the kitchen');
  const [steps, setSteps] = useState(() => generate('Clean the kitchen'));
  const [base, setBase] = useState('Clean the kitchen');
  const [level, setLevel] = useState(0);
  const [swiped, setSwiped] = useState(null);

  const close = () => { if (nav.canGoBack()) nav.goBack(); else nav.navigate('Now'); };

  const shrink = () => {
    const text = input.trim();
    if (!text) { Alert.alert('Type something first', "Type one big thing and I'll cut it up."); return; }
    Haptics.selectionAsync();
    if (text !== base || steps.length === 0) {
      setBase(text); setLevel(1);
      const fresh = generate(text);
      setSteps([mk(TINY[0], 1), ...fresh.map((s) => ({ ...s, minutes: Math.max(1, Math.round(s.minutes * 0.7)) }))]);
      return;
    }
    const lv = level + 1;
    setLevel(lv);
    setSteps((cur) => {
      const trimmed = cur.slice(0, 11).map((s, i) => (i === 0 ? s : { ...s, minutes: Math.max(1, Math.round(s.minutes * 0.75)) }));
      return [mk(TINY[lv % TINY.length], 1), ...trimmed];
    });
  };

  const onInput = (v) => {
    setInput(v);
    if (!v.trim()) { setSteps([]); setBase(''); setLevel(0); }
  };
  const onEdit = (id, v) => setSteps((c) => c.map((s) => (s.id === id ? { ...s, title: v } : s)));
  const onMove = (from, to) => setSteps((c) => { const n = c.slice(); const [x] = n.splice(from, 1); n.splice(to, 0, x); return n; });
  const onDelete = (item) => Alert.alert('Delete this step?', item.title, [
    { text: 'Cancel', style: 'cancel', onPress: () => setSwiped(null) },
    { text: 'Delete', style: 'destructive', onPress: () => { setSteps((c) => c.filter((s) => s.id !== item.id)); setSwiped(null); } },
  ]);

  const start = () => {
    const first = steps.find((s) => s.title.trim());
    if (!first) { Alert.alert('No steps yet', "Type one big thing and I'll cut it up."); return; }
    try {
      if (typeof setCurrentStep === 'function') {
        setCurrentStep({ id: first.id, title: first.title.trim(), minutes: first.minutes, remaining: first.minutes * 60, running: true });
      }
      Haptics.selectionAsync();
      nav.navigate('Now');
    } catch (e) {
      Alert.alert('Could not start', e?.message || 'Please try again.');
    }
  };

  const save = () => {
    const list = steps.filter((s) => s.title.trim());
    if (list.length === 0) { Alert.alert('Nothing to save', 'Add a big thing first and shrink it into steps.'); return; }
    if (typeof addTask === 'function') {
      list.forEach((s) => addTask({ title: s.title.trim(), minutes: s.minutes }));
      Alert.alert('Saved', `${list.length} steps added to your tasks.`, [{ text: 'OK', onPress: close }]);
    } else {
      Alert.alert('Saved', 'Your steps are ready. Tap Start first step to begin.');
    }
  };

  const hasSteps = steps.length > 0;

  return (
    <GlassBackground frozen={!!settings?.reduceMotion}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', paddingTop: insets.top + 8 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 20 }}>
            <View style={{ alignItems: 'center', paddingTop: 8 }}>
              <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Pressable onPress={close} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={[t.font.body, { color: t.textMuted, fontSize: 17, lineHeight: 22 }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={save} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={[t.font.label, { color: t.accentSoft, fontSize: 17, lineHeight: 22 }]}>Save</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[t.font.heading, { color: t.text, fontSize: 24, lineHeight: 31 }]}>Break it down</Text>
              <Pressable onPress={close} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={[t.font.body, { color: t.textMuted, fontSize: 17, lineHeight: 22 }]}>Close</Text>
              </Pressable>
            </View>

            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
              <GlassCard padding={16} radius={16}>
                <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
                  <TextInput
                    value={input}
                    onChangeText={onInput}
                    placeholder="What feels too big?"
                    placeholderTextColor={t.textMuted}
                    returnKeyType="done"
                    onSubmitEditing={shrink}
                    style={[t.font.body, { flex: 1, color: t.text, fontSize: 17, lineHeight: 22, minHeight: 44 }]}
                  />
                  <Pressable onPress={shrink} style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)' }}>
                    <Text style={[t.font.label, { color: t.accentSoft, fontSize: 15, lineHeight: 20 }]}>Shrink it</Text>
                  </Pressable>
                </View>
              </GlassCard>

              <View style={{ height: 12 }} />
              <GlassCard padding={12} radius={16}>
                {hasSteps ? steps.map((s, i) => (
                  <Step key={s.id} item={s} index={i} count={steps.length} onEdit={onEdit} onDelete={onDelete} onMove={onMove} swiped={swiped} setSwiped={setSwiped} t={t} />
                )) : (
                  <View style={{ minHeight: 120, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={[t.font.body, { color: t.textMuted, fontSize: 17, lineHeight: 24, textAlign: 'center' }]}>Type one big thing and I'll cut it up.</Text>
                  </View>
                )}
              </GlassCard>

              <Text style={[t.font.label, { color: t.textMuted, fontSize: 15, lineHeight: 20, marginTop: 12 }]}>These steps are a suggestion, not advice. Edit any of them.</Text>
            </ScrollView>

            <View style={{ paddingTop: 8, paddingBottom: insets.bottom + 16 }}>
              <GlassButton label="Start first step" onPress={start} height={64} radius={32} disabled={!hasSteps} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </GlassBackground>
  );
}
