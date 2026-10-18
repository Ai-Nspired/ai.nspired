import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../ui/theme';

export default function PipRow({ pips }) {
  const t = useTheme();
  const list = Array.isArray(pips) ? pips : [];
  const items = [];
  for (let i = 0; i < 7; i += 1) items.push(list[i] || 'empty');
  return (
    <View style={styles.row}>
      {items.map((state, i) => {
        let fill = 'transparent';
        let border = 'rgba(255,255,255,0.4)';
        if (state === 'done') {
          fill = t.accent;
          border = t.accent;
        } else if (state === 'grace') {
          fill = t.warning;
          border = t.warning;
        } else if (state === 'missed') {
          fill = 'rgba(169,155,201,0.35)';
          border = 'rgba(169,155,201,0.7)';
        }
        return (
          <View
            key={i}
            style={[styles.pip, { backgroundColor: fill, borderColor: border }]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  pip: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, marginRight: 6 },
});
