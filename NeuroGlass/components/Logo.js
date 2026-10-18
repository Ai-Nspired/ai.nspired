import React from 'react';
import Svg, { Rect, Circle } from 'react-native-svg';
import { useTheme } from '../ui/theme';

export default function Logo({ size = 48 }) {
  const t = useTheme();
  const base = t.dark ? '#7B6CF0' : '#6C5CE7';
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60" accessibilityLabel="Little Steps logo">
      <Rect x="2" y="2" width="56" height="56" rx="17" fill={base} />
      <Rect x="10" y="38" width="11" height="12" rx="3" fill="#FFFFFF" fillOpacity="0.55" />
      <Rect x="24.5" y="29" width="11" height="21" rx="3" fill="#FFFFFF" fillOpacity="0.78" />
      <Rect x="39" y="20" width="11" height="30" rx="3" fill="#FFFFFF" />
      <Circle cx="44.5" cy="11.5" r="3.8" fill="#FFC857" />
    </Svg>
  );
}
