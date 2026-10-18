import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '../ui/theme';

function format(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m < 10 ? '0' : ''}${m}:${r < 10 ? '0' : ''}${r}`;
}

export default function TimerText({ seconds, size = 96, color }) {
  const t = useTheme();
  return (
    <Text
      accessibilityRole="timer"
      accessibilityLabel={`${Math.floor(Math.max(0, Number(seconds) || 0) / 60)} minutes ${Math.max(0, Math.floor(Number(seconds) || 0)) % 60} seconds`}
      style={[
        t.font.title,
        {
          fontSize: size,
          lineHeight: Math.round(size * 1.2),
          color: color || t.text,
          fontVariant: ['tabular-nums'],
          textAlign: 'center',
        },
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {format(seconds)}
    </Text>
  );
}
