import React, { useState } from 'react';
import { View, Text, TextInput, Alert, Share, ScrollView } from 'react-native';
import { useTheme } from '../ui/theme';
import { FadeInView } from '../ui/kit';
import ToolFrame from '../components/ToolFrame';
import { Card, Btn, Chip, Segmented, SectionLabel, ErrorNote, success, tick } from '../components/Controls';
import { TOOLS } from '../constants/tools';
import { usePrefs } from '../store/PrefsContext';
import { formalize } from '../lib/ai';

const TOOL = TOOLS[1];
const TONES = ['Formal', 'Professional', 'Friendly', 'Casual', 'Polite', 'Direct', 'Concise', 'Warm', 'Playful'];
const FORMATS = [
  { key: 'As is', label: 'As is' },
  { key: 'Email', label: 'Email' },
  { key: 'Text', label: 'Text message' },
];

const words = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export default function FormalizerScreen() {
  const t = useTheme();
  const { language } = usePrefs();
  const [text, setText] = useState('');
  const [tone, setTone] = useState('Professional');
  const [format, setFormat] = useState('As is');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    const v = text.trim();
    if (!v) {
      Alert.alert('Add some text first', 'Type or paste what you want to rewrite.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const out = await formalize({ text: v, tone, format, language });
      setResult(out);
      success();
    } catch (e) {
      setError((e && e.message) || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const share = () => {
    Share.share({ message: result }).catch(() => Alert.alert('Could not share', 'Try again in a moment.'));
  };

  const useAsInput = () => {
    tick();
    setText(result);
    setResult('');
  };

  return (
    <ToolFrame style={{ flex: 1 }} title={TOOL.title} subtitle={TOOL.subtitle} help={TOOL.help}>
      <Card>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type or paste your text here…"
          placeholderTextColor={t.textMuted}
          multiline
          clearButtonMode="while-editing"
          style={[t.font.body, { color: t.text, minHeight: 130, textAlignVertical: 'top' }]}
        />
        <Text style={[t.font.caption, { color: t.textMuted, textAlign: 'right' }]}>{`${words(text)} words`}</Text>
      </Card>

      <SectionLabel style={{ marginTop: 20 }}>Tone</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
        {TONES.map((x) => (
          <View key={x} style={{ marginRight: 8 }}>
            <Chip label={x} active={tone === x} onPress={() => setTone(x)} />
          </View>
        ))}
      </ScrollView>

      <SectionLabel style={{ marginTop: 20 }}>Format</SectionLabel>
      <Segmented options={FORMATS} value={format} onChange={setFormat} height={40} />

      <Btn title={`Make it ${tone.toLowerCase()}`} icon="sparkles" onPress={run} loading={loading} disabled={!text.trim()} style={{ marginTop: 20 }} />
      <ErrorNote message={error} onRetry={run} />

      {result ? (
        <FadeInView style={{ marginTop: 20 }}>
          <SectionLabel>Result</SectionLabel>
          <Card>
            <Text selectable style={[t.font.body, { color: t.text }]}>{result}</Text>
            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <Btn title="Share" icon="share-outline" variant="secondary" onPress={share} height={44} style={{ flex: 1, marginRight: 8 }} />
              <Btn title="Redo" icon="refresh" variant="secondary" onPress={run} loading={loading} height={44} style={{ flex: 1 }} />
            </View>
            <Btn title="Use as new input" variant="ghost" onPress={useAsInput} height={44} style={{ marginTop: 8 }} />
          </Card>
        </FadeInView>
      ) : null}
    </ToolFrame>
  );
}
