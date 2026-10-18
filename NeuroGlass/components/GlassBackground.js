import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { useTheme } from '../ui/theme';

export default function GlassBackground({ children, frozen = false }) {
  const t = useTheme();
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (frozen) {
      drift.stopAnimation();
      drift.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 9000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 9000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [frozen, drift]);

  const moveA = drift.interpolate({ inputRange: [0, 1], outputRange: [0, 40] });
  const moveB = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -36] });

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.blob,
          styles.blobA,
          { backgroundColor: 'rgba(94,140,138,0.45)', transform: [{ translateX: moveA }, { translateY: moveB }] },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.blob,
          styles.blobB,
          { backgroundColor: 'rgba(169,155,201,0.28)', transform: [{ translateX: moveB }, { translateY: moveA }] },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.blob,
          styles.blobC,
          { backgroundColor: 'rgba(233,216,196,0.14)', transform: [{ translateX: moveA }] },
        ]}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  content: { flex: 1 },
  blob: { position: 'absolute', borderRadius: 999 },
  blobA: { width: 360, height: 360, top: -100, left: -120 },
  blobB: { width: 320, height: 320, top: 260, right: -140 },
  blobC: { width: 280, height: 280, bottom: -80, left: -60 },
});
