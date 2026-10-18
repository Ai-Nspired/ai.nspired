import React from 'react';
import { Text, Pressable, View, StyleSheet } from 'react-native';
import { useTheme } from '../ui/theme';

export default function StatusChip({ label, onPress, style }) {
  const t = useTheme();
  const content = (
    <Text style={[t.font.label, { color: t.text }]} numberOfLines={1}>
      {label}
    </Text>
  );
  const base = {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [base, style, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
});
