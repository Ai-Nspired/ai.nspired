import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ui/theme';
import ToolFrame from '../components/ToolFrame';
import { Card, Btn, Segmented, ErrorNote } from '../components/Controls';
import { signIn, signUp } from '../lib/wron-auth';
import { skipSignIn } from '../store/useAuthUser';

export default function SignInScreen() {
  const t = useTheme();
  const nav = useNavigation();
  const [mode, setMode] = useState('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const leave = () => {
    if (nav.canGoBack()) nav.goBack();
    else nav.navigate('Home');
  };

  const submit = async () => {
    const e = email.trim();
    if (!e || !e.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (!password || (mode === 'up' && password.length < 8)) {
      setError(mode === 'up' ? 'Choose a password with at least 8 characters.' : 'Enter your password.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      if (mode === 'up') await signUp({ email: e, password, name: name.trim() || null });
      else await signIn({ email: e, password });
      setPassword('');
      setBusy(false);
      Alert.alert(mode === 'up' ? 'Account created' : 'Signed in', 'Your lists are now saved to your account.', [{ text: 'OK', onPress: leave }]);
    } catch (err) {
      setBusy(false);
      setError((err && err.message) || 'Could not sign you in. Try again.');
    }
  };

  const field = {
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: t.bg,
    borderWidth: 1,
    borderColor: t.border,
    color: t.text,
  };

  return (
    <ToolFrame title="Keep your lists safe" subtitle="Optional. Sign in to carry your lists to a new phone." scroll>
      <Segmented
        options={[{ key: 'in', label: 'Sign in' }, { key: 'up', label: 'Create account' }]}
        value={mode}
        onChange={(k) => { setMode(k); setError(''); }}
        height={40}
      />
      <Card style={{ marginTop: 16 }}>
        {mode === 'up' ? (
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name (optional)"
            placeholderTextColor={t.textMuted}
            autoCapitalize="words"
            returnKeyType="next"
            style={[t.font.body, field, { marginBottom: 12 }]}
          />
        ) : null}
        <TextInput
          value={email}
          onChangeText={(v) => { setEmail(v); if (error) setError(''); }}
          placeholder="Email"
          placeholderTextColor={t.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          style={[t.font.body, field, { marginBottom: 12 }]}
        />
        <View style={[field, { flexDirection: 'row', alignItems: 'center', paddingRight: 4 }]}>
          <TextInput
            value={password}
            onChangeText={(v) => { setPassword(v); if (error) setError(''); }}
            placeholder="Password"
            placeholderTextColor={t.textMuted}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={submit}
            style={[t.font.body, { flex: 1, height: 50, color: t.text }]}
          />
          <Pressable
            onPress={() => setShow((s) => !s)}
            accessibilityRole="button"
            accessibilityLabel={show ? 'Hide password' : 'WRON_SECRET_REMOVED'}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={22} color={t.textMuted} />
          </Pressable>
        </View>
        <ErrorNote message={error} />
        <Btn title={mode === 'up' ? 'Create account' : 'Sign in'} onPress={submit} loading={busy} style={{ marginTop: 16 }} />
      </Card>
      <Btn title="Skip for now" variant="ghost" onPress={() => skipSignIn(nav)} style={{ marginTop: 12 }} />
      <Text style={[t.font.footnote, { color: t.textMuted, textAlign: 'center', marginTop: 4 }]}>
        Without an account your lists stay on this phone and sync later if you sign in.
      </Text>
    </ToolFrame>
  );
}
