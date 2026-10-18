import React from 'react';
import { View, Text, Alert, Share } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../ui/theme';
import { ListSection, ListRow } from '../ui/kit';
import ToolFrame from '../components/ToolFrame';
import { Segmented, Dropdown } from '../components/Controls';
import { usePrefs, LANGUAGES } from '../store/PrefsContext';
import useAuthUser, { openSignIn } from '../store/useAuthUser';
import { signOut } from '../lib/wron-auth';
import { listRecords, deleteRecord } from '../lib/wron-db';

const MODES = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'auto', label: 'Auto' },
];
const SPICES = ['1 · Mild', '2 · Gentle', '3 · Medium', '4 · Spicy', '5 · Extra spicy'];

export default function SettingsScreen() {
  const t = useTheme();
  const nav = useNavigation();
  const user = useAuthUser();
  const { mode, setMode, language, setLanguage, spice, setSpice } = usePrefs();

  const doSignOut = () => {
    Alert.alert('Sign out?', 'Lists on this device from before you signed in stay here. Your account lists come back when you sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (e) {
            Alert.alert('Could not sign out', (e && e.message) || 'Please try again.');
          }
        },
      },
    ]);
  };

  const wipe = () => {
    Alert.alert('Delete all my data?', 'Every Step Splitter list and One at a Time task will be permanently deleted. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete everything',
        style: 'destructive',
        onPress: async () => {
          try {
            const [a, b] = await Promise.all([listRecords('todo_lists'), listRecords('focus_tasks')]);
            await Promise.all([
              ...(a || []).map((r) => deleteRecord('todo_lists', r.id)),
              ...(b || []).map((r) => deleteRecord('focus_tasks', r.id)),
            ]);
            Alert.alert('All clear', 'Your lists and tasks were deleted.');
          } catch (e) {
            Alert.alert('Could not delete everything', (e && e.message) || 'Please try again.');
          }
        },
      },
    ]);
  };

  const share = () => {
    Share.share({ message: 'Little Steps: small, simple tools for when things feel too big or complicated.' }).catch(() =>
      Alert.alert('Could not share', 'Try again in a moment.')
    );
  };

  return (
    <ToolFrame title="Settings" subtitle="Make it comfortable" flush>
      <ListSection title="ACCOUNT" footer="Signing in keeps your lists safe and carries them to a new phone. Everything works without an account.">
        {user ? (
          <ListRow icon="person" iconBg={t.accents[0]} title={user.email} subtitle="Signed in" />
        ) : (
          <ListRow icon="person-outline" iconBg={t.accents[1]} title="Sign in or create account" accessory="chevron" onPress={() => openSignIn(nav)} />
        )}
        {user ? <ListRow icon="log-out-outline" iconBg={t.danger} title="Sign out" onPress={doSignOut} /> : null}
      </ListSection>

      <View style={{ marginBottom: 32 }}>
        <Text style={[t.font.footnote, { color: t.textMuted, marginLeft: 16, marginBottom: 7 }]}>APPEARANCE</Text>
        <View style={{ marginHorizontal: 16 }}>
          <Segmented options={MODES} value={mode} onChange={setMode} height={40} />
        </View>
      </View>

      <ListSection title="AI" footer="Output language is used by every tool. Spiciness is the starting level for new Step Splitter lists.">
        <Dropdown
          title="Output language"
          value={language}
          options={LANGUAGES}
          onChange={setLanguage}
          renderTrigger={(open) => <ListRow icon="globe-outline" iconBg={t.accents[2]} title="Output language" value={language} accessory="chevron" onPress={open} />}
        />
        <Dropdown
          title="Default spiciness"
          value={SPICES[spice - 1]}
          options={SPICES}
          onChange={(v) => setSpice(parseInt(v, 10))}
          renderTrigger={(open) => <ListRow icon="flame-outline" iconBg={t.accents[3]} title="Default spiciness" value={`${spice} of 5`} accessory="chevron" onPress={open} />}
        />
      </ListSection>

      <ListSection title="DATA AND SHARING">
        <ListRow icon="share-social-outline" iconBg={t.accents[4]} title="Share Little Steps" onPress={share} />
        <ListRow icon="trash-outline" iconBg={t.danger} title="Delete all my data" onPress={wipe} />
      </ListSection>
    </ToolFrame>
  );
}
