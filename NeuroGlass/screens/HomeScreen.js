import React, { useRef } from 'react';
import { View, Text, Pressable, ScrollView, Animated, Alert, Share, StyleSheet, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ui/theme';
import { FadeInView } from '../ui/kit';
import Logo from '../components/Logo';
import { IconButton, Segmented, Dropdown, tick } from '../components/Controls';
import { usePrefs, LANGUAGES } from '../store/PrefsContext';
import { TOOLS } from '../constants/tools';

function ToolCard({ tool, index, onPress }) {
  const t = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v) => Animated.spring(scale, { toValue: v, useNativeDriver: true, friction: 6, tension: 160 }).start();
  return (
    <FadeInView delay={index * 70} style={{ width: '48.5%', marginBottom: 14 }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={() => { tick(); onPress(); }}
          onPressIn={() => to(0.96)}
          onPressOut={() => to(1)}
          accessibilityRole="button"
          accessibilityLabel={`${tool.title}: ${tool.blurb}`}
          style={{
            minHeight: 172,
            borderRadius: 28,
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.border,
            borderTopWidth: 4,
            borderTopColor: tool.color,
            paddingHorizontal: 14,
            paddingVertical: 18,
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.07,
            shadowRadius: 10,
            elevation: 3,
          }}
        >
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: tool.color, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Ionicons name={tool.icon} size={28} color="#FFFFFF" />
          </View>
          <Text style={[t.font.headline, { color: t.text }]}>{tool.title}</Text>
          <Text style={[t.font.footnote, { color: t.textMuted, marginTop: 4 }]}>{tool.blurb}</Text>
        </Pressable>
      </Animated.View>
    </FadeInView>
  );
}

export default function HomeScreen() {
  const t = useTheme();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { language, setLanguage, mode, setMode } = usePrefs();
  const system = useColorScheme();
  const effective = mode === 'auto' ? (system === 'dark' ? 'dark' : 'light') : mode;

  const love = () => {
    tick();
    Alert.alert('Thanks for the love', 'Little Steps is a small, calm set of helpers. If it helps you, pass it on to someone who feels overwhelmed too.', [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Share the app',
        onPress: () => {
          Share.share({ message: 'Little Steps: small, simple tools for when things feel too big or complicated.' }).catch(() =>
            Alert.alert('Could not share', 'Try again in a moment.')
          );
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: t.border,
        }}
      >
        <Logo size={50} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[t.font.headline, { color: t.text }]}>Little Steps</Text>
          <View style={{ marginTop: 6, alignSelf: 'flex-start' }}>
            <Dropdown title="Output language" value={language} options={LANGUAGES} onChange={setLanguage} />
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconButton icon="heart" label="Spread the love" color="#E5333D" onPress={love} size={44} style={{ marginRight: 8 }} />
            <IconButton icon="settings" label="Settings" onPress={() => nav.navigate('Settings')} size={44} bg={t.accent} color={t.onAccent} borderColor={t.accent} />
          </View>
          <Segmented
            style={{ width: 96, marginTop: 8 }}
            height={36}
            value={effective}
            onChange={setMode}
            options={[{ key: 'light', icon: 'sunny', label: 'Light mode' }, { key: 'dark', icon: 'moon', label: 'Dark mode' }]}
          />
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: 28, paddingBottom: 20 }}>
          <Text accessibilityRole="header" style={[t.font.largeTitle, { color: t.text }]}>What feels big today?</Text>
          <Text style={[t.font.callout, { color: t.textMuted, marginTop: 8 }]}>
            Small, simple tools for when things feel too big or complicated.
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {TOOLS.map((tool, i) => (
            <ToolCard key={tool.route} tool={tool} index={i} onPress={() => nav.navigate(tool.route)} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
