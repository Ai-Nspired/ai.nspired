import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, Modal, TextInput, ActionSheetIOS, Platform, Animated, ActivityIndicator,
  ScrollView, KeyboardAvoidingView, StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ui/theme';

export const tick = () => {
  Haptics.selectionAsync().catch(() => {});
};
export const success = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};

export function usePalette() {
  const t = useTheme();
  return {
    blue: t.dark ? '#1FA3B5' : '#0E8A9B',
    strong: t.dark ? t.accent : '#5443C9',
  };
}

export function Card({ children, style }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.surface,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: t.border,
          padding: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function IconButton({ icon, onPress, label, active, size = 48, iconSize = 22, color, bg, disabled, style, borderColor }) {
  const t = useTheme();
  const bgc = bg || (active ? t.accent : t.surface);
  const fg = color || (active ? t.onAccent : t.text);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgc,
          borderWidth: 1,
          borderColor: borderColor || (active ? t.accent : t.border),
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={iconSize} color={fg} />
    </Pressable>
  );
}

export function Btn({ title, onPress, icon, variant = 'primary', disabled, loading, style, height = 52 }) {
  const t = useTheme();
  const { blue } = usePalette();
  let bg = t.accent;
  let fg = t.onAccent;
  let border = 'transparent';
  if (variant === 'blue') {
    bg = blue;
    fg = '#FFFFFF';
  } else if (variant === 'secondary') {
    bg = t.surface;
    fg = t.text;
    border = t.border;
  } else if (variant === 'danger') {
    bg = 'transparent';
    fg = t.danger;
    border = t.danger;
  } else if (variant === 'ghost') {
    bg = 'transparent';
    fg = blue;
  }
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        {
          height,
          borderRadius: 999,
          backgroundColor: bg,
          borderWidth: border === 'transparent' ? 0 : 1,
          borderColor: border,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={fg} style={{ marginRight: 8 }} /> : null}
          <Text style={[t.font.headline, { color: fg }]} numberOfLines={1}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Chip({ label, active, onPress, icon }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => { tick(); onPress && onPress(); }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 16,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: active ? t.accent : t.surface,
        borderWidth: 1,
        borderColor: active ? t.accent : t.border,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {icon ? <Ionicons name={icon} size={16} color={active ? t.onAccent : t.textMuted} style={{ marginRight: 6 }} /> : null}
      <Text style={[t.font.label, { color: active ? t.onAccent : t.text }]}>{label}</Text>
    </Pressable>
  );
}

export function SectionLabel({ children, style }) {
  const t = useTheme();
  return <Text style={[t.font.label, { color: t.textMuted, marginBottom: 8 }, style]}>{children}</Text>;
}

export function ErrorNote({ message, onRetry }) {
  const t = useTheme();
  if (!message) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: t.danger + '18', borderWidth: 1, borderColor: t.danger + '55', marginTop: 12 }}>
      <Ionicons name="alert-circle-outline" size={20} color={t.danger} />
      <Text style={[t.font.subhead, { color: t.text, flex: 1, marginLeft: 8 }]}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 8 }}>
          <Text style={[t.font.label, { color: t.danger }]}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function FlameRow({ level, size = 15 }) {
  const t = useTheme();
  const items = [];
  for (let i = 1; i <= 5; i += 1) {
    items.push(
      <Ionicons
        key={i}
        name={i <= level ? 'flame' : 'flame-outline'}
        size={size}
        color={i <= level ? '#F2994A' : t.textMuted}
        style={{ marginHorizontal: 1 }}
      />
    );
  }
  return <View style={{ flexDirection: 'row', alignItems: 'center' }}>{items}</View>;
}

export function Segmented({ options, value, onChange, height = 36, style }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const idx = Math.max(0, options.findIndex((o) => o.key === value));
  const seg = w > 0 ? (w - 6) / options.length : 0;
  useEffect(() => {
    Animated.spring(x, { toValue: idx * seg, useNativeDriver: true, friction: 9, tension: 120 }).start();
  }, [idx, seg, x]);
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[
        {
          height,
          borderRadius: 999,
          backgroundColor: t.surfaceAlt,
          borderWidth: 1,
          borderColor: t.border,
          padding: 2,
          flexDirection: 'row',
        },
        style,
      ]}
    >
      {w > 0 ? (
        <Animated.View
          style={{
            position: 'absolute',
            top: 2,
            left: 2,
            width: seg,
            height: height - 6,
            borderRadius: 999,
            backgroundColor: t.accent,
            transform: [{ translateX: x }],
          }}
        />
      ) : null}
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="button"
            accessibilityLabel={o.label || o.key}
            accessibilityState={{ selected: on }}
            onPress={() => { if (!on) { tick(); onChange(o.key); } }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 32 }}
          >
            {o.icon ? (
              <Ionicons name={o.icon} size={18} color={on ? t.onAccent : t.textMuted} />
            ) : (
              <Text style={[t.font.footnote, { color: on ? t.onAccent : t.textMuted }]} numberOfLines={1}>{o.label}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export function ActionSheetModal({ visible, title, actions, onClose }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close menu" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
      <View style={{ backgroundColor: t.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingBottom: insets.bottom + 12, maxHeight: '80%' }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: t.border, marginBottom: 8 }} />
        {title ? <Text style={[t.font.headline, { color: t.text, paddingHorizontal: 20, paddingVertical: 8 }]} numberOfLines={2}>{title}</Text> : null}
        <ScrollView>
          {(actions || []).map((a, i) => (
            <Pressable
              key={`${a.label}-${i}`}
              onPress={() => { onClose(); a.onPress && a.onPress(); }}
              accessibilityRole="button"
              style={({ pressed }) => ({
                minHeight: 52,
                paddingHorizontal: 20,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: pressed ? t.surfaceAlt : 'transparent',
              })}
            >
              {a.icon ? <Ionicons name={a.icon} size={22} color={a.danger ? t.danger : t.textMuted} style={{ width: 32 }} /> : null}
              <Text style={[t.font.body, { color: a.danger ? t.danger : t.text, flex: 1 }]}>{a.label}</Text>
              {a.selected ? <Ionicons name="checkmark" size={20} color={t.accent} /> : null}
            </Pressable>
          ))}
        </ScrollView>
        <Pressable onPress={onClose} style={{ minHeight: 52, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[t.font.headline, { color: t.textMuted }]}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

export function Dropdown({ value, options, onChange, title, renderTrigger }) {
  const t = useTheme();
  const [visible, setVisible] = useState(false);
  const open = () => {
    tick();
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title, options: [...options, 'Cancel'], cancelButtonIndex: options.length },
        (i) => { if (i < options.length) onChange(options[i]); }
      );
    } else {
      setVisible(true);
    }
  };
  return (
    <>
      {renderTrigger ? (
        renderTrigger(open)
      ) : (
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={`${title || 'Choose'}: ${value}`}
          style={({ pressed }) => ({
            minHeight: 44,
            paddingHorizontal: 16,
            borderRadius: 22,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.border,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="globe-outline" size={20} color={t.accent} />
          <Text style={[t.font.body, { color: t.text, marginHorizontal: 10 }]}>{value}</Text>
          <Ionicons name="chevron-down" size={14} color={t.textMuted} />
        </Pressable>
      )}
      <ActionSheetModal
        visible={visible}
        title={title}
        onClose={() => setVisible(false)}
        actions={options.map((o) => ({ label: o, selected: o === value, onPress: () => onChange(o) }))}
      />
    </>
  );
}

export function TextPrompt({ visible, title, value = '', placeholder, confirmLabel = 'Save', multiline, onCancel, onSubmit, children }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [v, setV] = useState(value);
  useEffect(() => {
    if (visible) setV(value);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = () => {
    if (!v.trim()) {
      Alert.alert('Type something first', 'This field cannot be empty.');
      return;
    }
    onSubmit(v);
  };
  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={{ backgroundColor: t.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: insets.bottom + 16 }}>
          <Text style={[t.font.heading, { color: t.text, marginBottom: 12 }]}>{title}</Text>
          <TextInput
            value={v}
            onChangeText={setV}
            placeholder={placeholder}
            placeholderTextColor={t.textMuted}
            autoFocus
            multiline={!!multiline}
            returnKeyType={multiline ? 'default' : 'done'}
            onSubmitEditing={multiline ? undefined : submit}
            clearButtonMode="while-editing"
            style={[
              t.font.body,
              {
                color: t.text,
                backgroundColor: t.surface,
                borderWidth: 1,
                borderColor: t.border,
                borderRadius: 16,
                paddingHorizontal: 14,
                paddingVertical: 12,
                minHeight: multiline ? 140 : 52,
                textAlignVertical: multiline ? 'top' : 'center',
              },
            ]}
          />
          {children}
          <View style={{ flexDirection: 'row', marginTop: 16 }}>
            <Btn title="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1, marginRight: 8 }} />
            <Btn title={confirmLabel} onPress={submit} style={{ flex: 1.3 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
