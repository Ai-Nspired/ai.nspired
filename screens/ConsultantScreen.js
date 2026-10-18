import React, { useState } from 'react';
import { View, Text, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ui/theme';
import { FadeInView } from '../ui/kit';
import ToolFrame from '../components/ToolFrame';
import { Card, Btn, SectionLabel, ErrorNote, success, tick } from '../components/Controls';
import { TOOLS } from '../constants/tools';
import { usePrefs } from '../store/PrefsContext';
import { consult } from '../lib/ai';

const TOOL = TOOLS[5];

function Bullets({ items, icon, color }) {
  const t = useTheme();
  return (items || []).map((x, i) => (
    <View key={`${x}-${i}`} style={{ flexDirection: 'row', marginTop: 6 }}>
      <Ionicons name={icon} size={18} color={color} style={{ marginTop: 2 }} />
      <Text style={[t.font.subhead, { color: t.text, flex: 1, marginLeft: 8 }]}>{x}</Text>
    </View>
  ));
}

export default function ConsultantScreen() {
  const t = useTheme();
  const { language } = usePrefs();
  const [dilemma, setDilemma] = useState('');
  const [options, setOptions] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    const d = dilemma.trim();
    if (!d) {
      Alert.alert('Describe the decision first', 'Tell Decider what you are trying to decide.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const out = await consult({ dilemma: d, options: options.trim(), language });
      setResult(out);
      success();
    } catch (e) {
      setError((e && e.message) || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const flip = () => {
    const names = (result && result.options ? result.options : []).map((o) => o.name).filter(Boolean);
    if (names.length < 2) {
      Alert.alert('Not enough options', 'Run Decider first so there are options to choose between.');
      return;
    }
    tick();
    const pick = names[Math.floor(Math.random() * names.length)];
    Alert.alert('The coin says', `${pick}\n\nHow do you feel about that? Your reaction is useful information too.`);
  };

  return (
    <ToolFrame title={TOOL.title} subtitle={TOOL.subtitle} help={TOOL.help}>
      <SectionLabel>What are you trying to decide?</SectionLabel>
      <Card>
        <TextInput
          value={dilemma}
          onChangeText={setDilemma}
          placeholder="e.g. Should I take the new job in another city?"
          placeholderTextColor={t.textMuted}
          multiline
          clearButtonMode="while-editing"
          style={[t.font.body, { color: t.text, minHeight: 90, textAlignVertical: 'top' }]}
        />
      </Card>
      <SectionLabel style={{ marginTop: 16 }}>Options you are considering (optional)</SectionLabel>
      <Card>
        <TextInput
          value={options}
          onChangeText={setOptions}
          placeholder="e.g. Take the job, stay, ask for a raise"
          placeholderTextColor={t.textMuted}
          returnKeyType="done"
          clearButtonMode="while-editing"
          style={[t.font.body, { color: t.text, minHeight: 28 }]}
        />
      </Card>
      <Btn title="Help me decide" icon="bulb-outline" onPress={run} loading={loading} disabled={!dilemma.trim()} style={{ marginTop: 20 }} />
      <ErrorNote message={error} onRetry={run} />

      {result ? (
        <FadeInView style={{ marginTop: 20 }}>
          {result.summary ? (
            <Card>
              <Text style={[t.font.footnote, { color: t.textMuted }]}>The dilemma</Text>
              <Text style={[t.font.body, { color: t.text, marginTop: 4 }]}>{result.summary}</Text>
            </Card>
          ) : null}
          {(result.options || []).map((o, i) => (
            <Card key={`${o.name}-${i}`} style={{ marginTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.accents[i % t.accents.length], marginRight: 8 }} />
                <Text style={[t.font.headline, { color: t.text, flex: 1 }]}>{o.name}</Text>
              </View>
              <Bullets items={o.pros} icon="add-circle" color={t.success} />
              <Bullets items={o.cons} icon="remove-circle" color={t.danger} />
            </Card>
          ))}
          {(result.questions || []).length > 0 ? (
            <Card style={{ marginTop: 12 }}>
              <SectionLabel>Ask yourself</SectionLabel>
              <Bullets items={result.questions} icon="help-circle-outline" color={t.textMuted} />
            </Card>
          ) : null}
          {result.leaning ? (
            <Card style={{ marginTop: 12, backgroundColor: t.accentSoft, borderColor: t.accent }}>
              <Text style={[t.font.footnote, { color: t.dark ? t.text : '#3A2F9E' }]}>Leaning toward</Text>
              <Text style={[t.font.title2, { color: t.dark ? t.text : '#1E1B3A', marginTop: 2 }]}>{result.leaning}</Text>
              {result.reason ? <Text style={[t.font.body, { color: t.dark ? t.text : '#1E1B3A', marginTop: 6 }]}>{result.reason}</Text> : null}
            </Card>
          ) : null}
          <Btn title="Still stuck? Flip a coin" icon="shuffle" variant="secondary" onPress={flip} style={{ marginTop: 12 }} />
          <Text style={[t.font.caption, { color: t.textMuted, marginTop: 12, textAlign: 'center' }]}>This is a thinking aid. The decision is yours.</Text>
        </FadeInView>
      ) : null}
    </ToolFrame>
  );
}
