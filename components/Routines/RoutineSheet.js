import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, Switch } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../ui/theme';
import GlassButton from '../GlassButton';

const pad = (n) => String(n).padStart(2, '0');

function Stepper({ label, value, onUp, onDown, t }) {
  return (
    <View style={{ alignItems: 'center', minWidth: 88 }}>
      <Pressable accessibilityLabel={`Increase ${label}`} onPress={onUp} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="chevron-up" size={24} color={t.text} />
      </Pressable>
      <Text style={[t.font.title, { color: t.text, fontSize: 44, lineHeight: 57 }]}>{pad(value)}</Text>
      <Pressable accessibilityLabel={`Decrease ${label}`} onPress={onDown} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="chevron-down" size={24} color={t.text} />
      </Pressable>
    </View>
  );
}

export default function RoutineSheet({ routine, onClose, onSave }) {
  const t = useTheme();
  const [h, setH] = useState(8);
  const [m, setM] = useState(0);
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!routine) return;
    const parts = String(routine.time || '08:00').split(':');
    const hh = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10);
    setH(Number.isFinite(hh) ? hh : 8);
    setM(Number.isFinite(mm) ? mm : 0);
    setOn(!!routine.reminderOn);
  }, [routine?.id]);

  const tick = () => Haptics.selectionAsync().catch(() => {});

  return (
    <Modal visible={!!routine} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} />
      <View style={{ backgroundColor: t.bg, padding: 20, paddingBottom: 36, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
        <Text style={[t.font.heading, { color: t.text }]}>{routine?.title}</Text>
        <Text style={[t.font.label, { color: t.textMuted, marginTop: 4 }]}>Time</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginVertical: 12 }}>
          <Stepper t={t} label="hour" value={h} onUp={() => { tick(); setH((h + 1) % 24); }} onDown={() => { tick(); setH((h + 23) % 24); }} />
          <Text style={[t.font.title, { color: t.text, fontSize: 44, lineHeight: 57 }]}>:</Text>
          <Stepper t={t} label="minute" value={m} onUp={() => { tick(); setM((m + 5) % 60); }} onDown={() => { tick(); setM((m + 55) % 60); }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, marginBottom: 16 }}>
          <Text style={[t.font.body, { color: t.text, flex: 1 }]}>Reminder</Text>
          <Switch value={on} onValueChange={(v) => { tick(); setOn(v); }} />
        </View>
        <GlassButton label="Save" onPress={() => onSave(`${pad(h)}:${pad(m)}`, on)} />
        <GlassButton label="Cancel" variant="text" onPress={onClose} style={{ marginTop: 8 }} />
      </View>
    </Modal>
  );
}
