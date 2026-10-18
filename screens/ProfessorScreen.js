import React, { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ui/theme';
import { FadeInView } from '../ui/kit';
import ToolFrame from '../components/ToolFrame';
import { Segmented, Chip, ErrorNote, IconButton, usePalette, success } from '../components/Controls';
import { TOOLS } from '../constants/tools';
import { usePrefs } from '../store/PrefsContext';
import { professorReply } from '../lib/ai';

const TOOL = TOOLS[4];
const LEVELS = [
  { key: 'ELI5', label: 'Age 5' },
  { key: 'Simple', label: 'Simple' },
  { key: 'Detailed', label: 'Detailed' },
  { key: 'Expert', label: 'Expert' },
];
const IDEAS = ['How do vaccines work?', 'What is inflation?', 'Why is the sky blue?', 'How does a mortgage work?'];

export default function ProfessorScreen() {
  const t = useTheme();
  const { blue } = usePalette();
  const { language } = usePrefs();
  const [level, setLevel] = useState('Simple');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const last = useRef('');

  const send = async (override) => {
    const q = (typeof override === 'string' ? override : input).trim();
    if (!q) {
      Alert.alert('Ask something first', 'Type a question, then tap send.');
      return;
    }
    const history = [...messages, { role: 'user', content: q }];
    last.current = q;
    setMessages(history);
    setInput('');
    setLoading(true);
    setError('');
    try {
      const reply = await professorReply({ messages: history, level, language });
      setMessages([...history, { role: 'assistant', content: reply }]);
      success();
    } catch (e) {
      setMessages(messages);
      setInput(q);
      setError((e && e.message) || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    Alert.alert('Start over?', 'This clears the whole conversation.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => { setMessages([]); setError(''); } },
    ]);
  };

  const shareAnswer = (m) => {
    Share.share({ message: m.content }).catch(() => Alert.alert('Could not share', 'Try again in a moment.'));
  };

  const footer = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      <TextInput
        value={input}
        onChangeText={setInput}
        placeholder={messages.length ? 'Ask a follow-up…' : 'What would you like explained?'}
        placeholderTextColor={t.textMuted}
        multiline
        style={[t.font.body, { flex: 1, maxHeight: 120, minHeight: 52, borderRadius: 16, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, color: t.text, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border }]}
      />
      <Pressable
        onPress={() => send()}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Send question"
        style={({ pressed }) => ({ width: 52, height: 52, borderRadius: 16, marginLeft: 8, backgroundColor: blue, alignItems: 'center', justifyContent: 'center', opacity: loading ? 0.5 : pressed ? 0.75 : 1 })}
      >
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="arrow-up" size={26} color="#FFFFFF" />}
      </Pressable>
    </View>
  );

  return (
    <ToolFrame title={TOOL.title} subtitle={TOOL.subtitle} help={TOOL.help} footer={footer}>
      <Text style={[t.font.label, { color: t.textMuted, marginBottom: 8 }]}>Explain it at this level</Text>
      <Segmented options={LEVELS} value={level} onChange={setLevel} height={40} />

      {messages.length === 0 ? (
        <View style={{ marginTop: 28 }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 84, height: 84, borderRadius: 28, backgroundColor: TOOL.color + '2A', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="school-outline" size={42} color={TOOL.color} />
            </View>
            <Text style={[t.font.heading, { color: t.text, marginTop: 16 }]}>Ask anything</Text>
            <Text style={[t.font.callout, { color: t.textMuted, textAlign: 'center', marginTop: 6, marginBottom: 16 }]}>No question is too small. Try one of these:</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
            {IDEAS.map((q) => (
              <View key={q} style={{ margin: 4 }}>
                <Chip label={q} onPress={() => send(q)} />
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={{ marginTop: 16 }}>
          {messages.map((m, i) => {
            const mine = m.role === 'user';
            return (
              <FadeInView key={i} style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                <View style={{ maxWidth: '92%', borderRadius: 18, padding: 14, backgroundColor: mine ? t.accent : t.surface, borderWidth: mine ? 0 : 1, borderColor: t.border }}>
                  <Text selectable style={[t.font.body, { color: mine ? t.onAccent : t.text }]}>{m.content}</Text>
                  {!mine ? (
                    <Pressable onPress={() => shareAnswer(m)} accessibilityRole="button" accessibilityLabel="Share this answer" style={{ minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start', marginTop: 4 }}>
                      <Text style={[t.font.label, { color: blue }]}>Share</Text>
                    </Pressable>
                  ) : null}
                </View>
              </FadeInView>
            );
          })}
          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator color={t.accent} />
              <Text style={[t.font.subhead, { color: t.textMuted, marginLeft: 8 }]}>The Professor is thinking…</Text>
            </View>
          ) : null}
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <IconButton icon="trash-outline" label="Clear conversation" onPress={clear} size={44} />
          </View>
        </View>
      )}
      <ErrorNote message={error} onRetry={() => send(last.current)} />
    </ToolFrame>
  );
}
