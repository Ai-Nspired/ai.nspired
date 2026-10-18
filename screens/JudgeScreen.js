import React, { useState } from 'react';
import { View, Text, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ui/theme';
import { FadeInView, ProgressBar, Screen } from '../ui/kit';
import ToolFrame from '../components/ToolFrame';
import { Card, Btn, SectionLabel, ErrorNote, success } from '../components/Controls';
import { TOOLS } from '../constants/tools';
import { usePrefs } from '../store/PrefsContext';
import { judgeText } from '../lib/ai';

const TOOL = TOOLS[2];

const VALENCE = {
  positive: { icon: 'happy-outline', key: 'success' },
  negative: { icon: 'sad-outline', key: 'danger' },
  mixed: { icon: 'swap-horizontal-outline', key: 'warning' },
  neutral: { icon: 'remove-circle-outline', key: 'textMuted' },
};

function Fact({ label, value }) {
  const t = useTheme();
  if (!value) return null;
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={[t.font.footnote, { color: t.textMuted }]}>{label}</Text>
      <Text style={[t.font.body, { color: t.text, marginTop: 2 }]}>{value}</Text>
    </View>
  );
}

export default function JudgeScreen() {
  const t = useTheme();
  const { language } = usePrefs();
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    const v = text.trim();
    if (!v) {
      Alert.alert('Add a message first', 'Paste the text you want read for emotion.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const out = await judgeText({ text: v, language });
      setResult(out);
      success();
    } catch (e) {
      setError((e && e.message) || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setText('');
    setResult(null);
    setError('');
  };

  const v = result ? VALENCE[String(result.valence || '').toLowerCase()] || VALENCE.neutral : VALENCE.neutral;
  const vColor = t[v.key];
  const emotions = result && Array.isArray(result.emotions) ? result.emotions.slice(0, 5) : [];

  return (
    <Screen scroll={false} padded={false}>
    <ToolFrame insetTop={false} style={{ flex: 1 }} title={TOOL.title} subtitle={TOOL.subtitle} help={TOOL.help}>
      <Card>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Paste a message to read…"
          placeholderTextColor={t.textMuted}
          multiline
          clearButtonMode="while-editing"
          style={[t.font.body, { color: t.text, minHeight: 130, textAlignVertical: 'top' }]}
        />
      </Card>
      <View style={{ flexDirection: 'row', marginTop: 16 }}>
        {text || result ? <Btn title="Clear" variant="secondary" onPress={clear} style={{ flex: 1, marginRight: 8 }} /> : null}
        <Btn title="Judge this text" icon="scale-outline" onPress={run} loading={loading} disabled={!text.trim()} style={{ flex: 2 }} />
      </View>
      <ErrorNote message={error} onRetry={run} />

      {result ? (
        <FadeInView style={{ marginTop: 20 }}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: vColor + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={v.icon} size={32} color={vColor} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[t.font.footnote, { color: t.textMuted }]}>Sounds</Text>
                <Text style={[t.font.title2, { color: t.text }]}>{result.primary}</Text>
              </View>
            </View>
            {result.summary ? <Text style={[t.font.body, { color: t.text, marginTop: 14 }]}>{result.summary}</Text> : null}
          </Card>

          {emotions.length > 0 ? (
            <Card style={{ marginTop: 12 }}>
              <SectionLabel>Emotions</SectionLabel>
              {emotions.map((e, i) => {
                const val = Math.max(0, Math.min(100, Number(e.intensity) || 0));
                return (
                  <View key={`${e.name}-${i}`} style={{ marginBottom: i === emotions.length - 1 ? 0 : 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={[t.font.body, { color: t.text }]}>{e.name}</Text>
                      <Text style={[t.font.subhead, { color: t.textMuted }]}>{`${Math.round(val)}%`}</Text>
                    </View>
                    <ProgressBar value={val / 100} color={t.accents[i % t.accents.length]} height={8} />
                  </View>
                );
              })}
            </Card>
          ) : null}

          <Card style={{ marginTop: 12 }}>
            <Fact label="Formality" value={result.formality} />
            <Fact label="Likely intent" value={result.intent} />
            <Fact label="How it may land" value={result.landing} />
            <Fact label="If you reply" value={result.tip} />
            <Text style={[t.font.caption, { color: t.textMuted, marginTop: 16 }]}>This is a reading, not a verdict. Tone is easy to misjudge in text.</Text>
          </Card>
        </FadeInView>
      ) : null}
    </ToolFrame>
    </Screen>
  );
}
