import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ui/theme';

export default function GlassHeader({ title, onBack, right }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: (insets?.top || 0) + 4,
          backgroundColor: 'rgba(255,255,255,0.10)',
          borderBottomColor: 'rgba(255,255,255,0.25)',
        },
      ]}
    >
      <View style={styles.side}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={26} color={t.text} />
          </Pressable>
        ) : null}
      </View>
      <Text style={[t.font.headline || t.font.label, styles.title, { color: t.text }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.sideRight]}>{right || null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  side: { width: 56, minHeight: 44, justifyContent: 'center' },
  sideRight: { alignItems: 'flex-end' },
  hit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  title: { flex: 1, textAlign: 'center' },
});
