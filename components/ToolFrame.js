import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ui/theme';
import Logo from './Logo';
import { IconButton, ActionSheetModal } from './Controls';
import { TOOLS } from '../constants/tools';
import useAuthUser from '../store/useAuthUser';

export default function ToolFrame({ title, subtitle, help, headerRight, children, footer, scroll = true, flush = false, style, insetTop = true }) {
  const t = useTheme();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const user = useAuthUser();
  const [menu, setMenu] = useState(false);

  const go = (route) => nav.navigate(route);
  const actions = [
    { label: 'Home', icon: 'home-outline', onPress: () => go('Home') },
    ...TOOLS.map((x) => ({ label: x.title, icon: `${x.icon}-outline`, onPress: () => go(x.route) })),
    { label: 'Settings', icon: 'settings-outline', onPress: () => go('Settings') },
    { label: user ? 'Account' : 'Sign in', icon: 'person-outline', onPress: () => go(user ? 'Settings' : 'Sign in') },
  ];

  const padH = flush ? 0 : 16;
  const titleBlock = (
    <View style={{ paddingTop: 20, paddingBottom: 16, paddingHorizontal: flush ? 16 : 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, paddingRight: help ? 8 : 0 }}>
          <Text accessibilityRole="header" style={[t.font.title, { color: t.text }]}>{title}</Text>
          {subtitle ? <Text style={[t.font.subhead, { color: t.textMuted, marginTop: 4 }]}>{subtitle}</Text> : null}
        </View>
        {help ? (
          <Pressable
            onPress={() => Alert.alert(title, help)}
            accessibilityRole="button"
            accessibilityLabel={`Help for ${title}`}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: t.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons name="information" size={22} color={t.dark ? t.text : t.accent} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[{ flex: 1, backgroundColor: t.bg }, style]}>
      <View
        style={{
          paddingTop: (insetTop ? insets.top : 0) + 6,
          paddingBottom: 10,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: t.border,
          backgroundColor: t.bg,
        }}
      >
        <Pressable
          onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate('Home'))}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8, opacity: pressed ? 0.5 : 1 })}
        >
          <Ionicons name="chevron-back" size={28} color={t.text} />
        </Pressable>
        <Pressable onPress={() => nav.navigate('Home')} accessibilityRole="button" accessibilityLabel="Little Steps home" style={{ marginLeft: 4 }}>
          <Logo size={38} />
        </Pressable>
        <View style={{ flex: 1 }} />
        {headerRight}
        <IconButton icon="ellipsis-horizontal" label="Menu" size={46} onPress={() => setMenu(true)} style={{ marginLeft: 8 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: padH, paddingBottom: 24 }}
          >
            {titleBlock}
            {children}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, paddingHorizontal: padH }}>
            {titleBlock}
            {children}
          </View>
        )}
        {footer ? (
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: Math.max(insets.bottom, 12),
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: t.border,
              backgroundColor: t.bg,
            }}
          >
            {footer}
          </View>
        ) : (
          <View style={{ height: insets.bottom }} />
        )}
      </KeyboardAvoidingView>

      <ActionSheetModal visible={menu} title="Little Steps" actions={actions} onClose={() => setMenu(false)} />
    </View>
  );
}
