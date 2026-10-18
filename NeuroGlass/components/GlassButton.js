import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ui/theme';

export default function GlassButton({
  label,
  onPress,
  variant = 'primary',
  height = 56,
  radius = 28,
  style,
  disabled,
  icon,
}) {
  const t = useTheme();
  let fill = 'transparent';
  let borderColor = 'transparent';
  let borderWidth = 0;
  let color = t.text;

  if (variant === 'primary') {
    fill = t.accent;
    color = '#FFFFFF';
  } else if (variant === 'secondary') {
    fill = 'rgba(255,255,255,0.14)';
    borderColor = 'rgba(255,255,255,0.25)';
    borderWidth = 1;
    color = t.text;
  } else if (variant === 'white') {
    fill = 'rgba(255,255,255,0.92)';
    color = '#1E3A44';
  } else if (variant === 'danger') {
    fill = 'rgba(194,84,79,0.16)';
    borderColor = 'rgba(194,84,79,0.45)';
    borderWidth = 1;
    color = t.danger;
  } else if (variant === 'text') {
    color = t.text;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          borderRadius: radius,
          backgroundColor: fill,
          borderColor,
          borderWidth,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <View style={styles.inner}>
        {icon ? (
          <Ionicons name={icon} size={20} color={color} style={styles.icon} />
        ) : null}
        <Text style={[t.font.headline || t.font.label, { color }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  icon: { marginRight: 8 },
});
