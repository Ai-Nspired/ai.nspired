import React from 'react';
import { ImageBackground, View, Text, Pressable, StatusBar, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ART } from '../constants/artwork';
import { useTheme } from '../ui/theme';
import { useStore } from '../store/StoreContext';
import { openSignIn, skipSignIn } from '../store/useAuthUser';

export default function WelcomeScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { completeOnboarding } = useStore() || {};

  const onStart = async () => {
    try {
      if (completeOnboarding) await completeOnboarding();
      openSignIn(navigation);
    } catch (e) {
      Alert.alert('Could not continue', (e && e.message) || 'Please try again.');
    }
  };

  const onSkip = async () => {
    try {
      if (completeOnboarding) await completeOnboarding();
      skipSignIn(navigation);
    } catch (e) {
      Alert.alert('Could not continue', (e && e.message) || 'Please try again.');
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ImageBackground
        source={{ uri: ART.welcomeBackground }}
        resizeMode="cover"
        style={{ flex: 1, width: '100%', height: '100%' }}
      >
        <View pointerEvents="none" style={[styles.scrim, styles.top]} />
        <View pointerEvents="none" style={[styles.scrim, styles.bottom]} />
        <View
          style={{
            flex: 1,
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 16,
            paddingHorizontal: 24,
            justifyContent: 'space-between',
          }}
        >
          <View>
            <Text
              style={[
                t.font.display2,
                { color: '#FFFFFF' },
              ]}
            >
              One thing at a time.
            </Text>
            <Text
              style={[
                t.font.body,
                { fontSize: 17, lineHeight: 24, color: 'rgba(255,255,255,0.9)', marginTop: 12 },
              ]}
            >
              A quiet helper that shows only your next small step.
            </Text>
          </View>
          <View>
          <Pressable
            onPress={onStart}
            accessibilityRole="button"
            accessibilityLabel="Get started"
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: t.accent, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text
              style={[
                t.font.label,
                { fontSize: 17, lineHeight: Math.round(17 * 1.3), color: t.onAccent },
              ]}
            >
              Get started
            </Text>
          </Pressable>
          <Pressable
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel="Not now"
            style={({ pressed }) => ({ height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8, opacity: pressed ? 0.7 : 1 })}
          >
            <Text style={[t.font.label, { color: '#FFFFFF' }]}>Not now</Text>
          </Pressable>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  scrim: { position: 'absolute', left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.25)' },
  top: { top: 0, height: '30%' },
  bottom: { bottom: 0, height: '20%', backgroundColor: 'rgba(0,0,0,0.2)' },
  cta: {
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
