import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, Share, ActivityIndicator, ScrollView, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ui/theme';
import { Screen } from '../ui/kit';
import ToolFrame from '../components/ToolFrame';
import { IconButton, Btn, ActionSheetModal, TextPrompt, FlameRow, ErrorNote, usePalette, tick, success } from '../components/Controls';
import { TOOLS } from '../constants/tools';
import { usePrefs } from '../store/PrefsContext';
import useTodoLists from '../store/useTodoLists';
import { breakDown, estimateTimes } from '../lib/ai';
import {
  newItem, updateItem, setDoneDeep, removeItem, moveItem, clearDone, flatten, leaves, applyMins,
  countAll, toText, iconFor, formatMins,
} from '../lib/todoTree';

const TOOL = TOOLS[0];
const SPICE = [
  { level: 1, name: 'Mild', note: 'A few broad steps' },
  { level: 2, name: 'Gentle', note: 'Clear, practical steps' },
  { level: 3, name: 'Medium', note: 'Small, concrete steps' },
  { level: 4, name: 'Spicy', note: 'Very small steps' },
  { level: 5, name: 'Extra spicy', note: 'Tiny steps, easiest first move' },
];

export default function MagicTodoScreen() {
  const t = useTheme();
  const { blue, strong } = usePalette();
  const { language, spice: defaultSpice } = usePrefs();
  const L = useTodoLists(defaultSpice);
  const active = L.lists.find((l) => l.id === L.activeId) || null;

  const [text, setText] = useState('');
  const [busy, setBusy] = useState({});
  const [hideDone, setHideDone] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [spiceOpen, setSpiceOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newBreak, setNewBreak] = useState(true);

  const setB = (k, v) => setBusy((b) => ({ ...b, [k]: v }));
  const rows = useMemo(() => (active ? flatten(active.items, hideDone) : []), [active, hideDone]);
  const stats = active ? countAll(active.items) : { done: 0, total: 0, minsLeft: 0 };

  const breakItem = async (listId, item) => {
    const list = L.lists.find((l) => l.id === listId);
    if (!list) return;
    setB(item.id, true);
    try {
      const steps = await breakDown({ task: item.text, spice: list.spice, language, listName: list.name });
      if (!steps.length) throw new Error('No steps came back. Try again.');
      L.mutate(listId, (items) =>
        updateItem(items, item.id, (it) => ({ ...it, done: false, children: [...it.children, ...steps.map(newItem)] }))
      );
      success();
    } catch (e) {
      Alert.alert('Could not break that down', (e && e.message) || 'Please try again.');
    } finally {
      setB(item.id, false);
    }
  };

  const onAdd = () => {
    const v = text.trim();
    if (!active) {
      Alert.alert('Make a list first', 'Create a list with the + button, then add items to it.');
      return;
    }
    if (!v) {
      Alert.alert('Add an item first', 'Type a task, then tap +.');
      return;
    }
    tick();
    setText('');
    L.mutate(active.id, (items) => [...items, newItem(v)]);
  };

  const createList = async (name) => {
    const clean = name.trim();
    if (!clean) return;
    setNewOpen(false);
    setB('create', true);
    try {
      const list = await L.addList(clean, defaultSpice);
      if (newBreak) {
        try {
          const steps = await breakDown({ task: clean, spice: list.spice, language, listName: clean });
          if (steps.length) L.mutate(list.id, () => steps.map(newItem));
        } catch (e) {
          Alert.alert('List created without steps', `${(e && e.message) || 'Magic could not break it down.'} You can add items yourself or try the wand later.`);
        }
      }
    } catch (e) {
      Alert.alert('Could not create the list', (e && e.message) || 'Please try again.');
    } finally {
      setB('create', false);
    }
  };

  const fillFromName = async () => {
    if (!active) return;
    setB('fill', true);
    try {
      const steps = await breakDown({ task: active.name, spice: active.spice, language, listName: active.name });
      if (!steps.length) throw new Error('No steps came back. Try again.');
      L.mutate(active.id, (items) => [...items, ...steps.map(newItem)]);
      success();
    } catch (e) {
      Alert.alert('Could not break that down', (e && e.message) || 'Please try again.');
    } finally {
      setB('fill', false);
    }
  };

  const breakAll = () => {
    if (!active) return;
    const targets = leaves(active.items).filter((x) => !x.done).slice(0, 10);
    if (targets.length === 0) {
      Alert.alert('Nothing to break down', 'Add some unfinished items first.');
      return;
    }
    Alert.alert('Break down every open item?', `Magic will split ${targets.length} item${targets.length === 1 ? '' : 's'} into smaller steps. You can undo it afterwards.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Break them down',
        onPress: async () => {
          setB('all', true);
          let failed = 0;
          for (const it of targets) {
            try {
              const steps = await breakDown({ task: it.text, spice: active.spice, language, listName: active.name });
              if (steps.length) {
                L.mutate(active.id, (items) => updateItem(items, it.id, (x) => ({ ...x, children: [...x.children, ...steps.map(newItem)] })));
              } else failed += 1;
            } catch (e) {
              failed += 1;
            }
          }
          setB('all', false);
          if (failed) Alert.alert('Mostly done', `${failed} item${failed === 1 ? '' : 's'} could not be broken down. Try those again with the wand.`);
          else success();
        },
      },
    ]);
  };

  const estimate = async () => {
    if (!active) return;
    const lv = leaves(active.items).filter((x) => !x.done);
    if (lv.length === 0) {
      Alert.alert('Nothing to estimate', 'Add some unfinished items first.');
      return;
    }
    setB('est', true);
    try {
      const mins = await estimateTimes({ tasks: lv.map((x) => x.text), language });
      const map = {};
      lv.forEach((x, i) => { map[x.id] = mins[i]; });
      L.mutate(active.id, (items) => applyMins(items, map));
      success();
    } catch (e) {
      Alert.alert('Could not estimate time', (e && e.message) || 'Please try again.');
    } finally {
      setB('est', false);
    }
  };

  const toggle = (it) => {
    tick();
    L.mutate(active.id, (items) => updateItem(items, it.id, (x) => setDoneDeep(x, !x.done)));
  };

  const confirmDelete = (it) => {
    Alert.alert('Delete this item?', it.children.length ? `"${it.text}" and its ${it.children.length} sub-steps will be removed.` : `"${it.text}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => L.mutate(active.id, (items) => removeItem(items, it.id)) },
    ]);
  };

  const shareList = () => {
    if (!active || active.items.length === 0) {
      Alert.alert('Nothing to share yet', 'Add some items first.');
      return;
    }
    Share.share({ message: toText(active.name, active.items) }).catch(() => Alert.alert('Could not share', 'Try again in a moment.'));
  };

  const doDeleteList = () => {
    if (!active) return;
    Alert.alert('Delete this list?', `"${active.name}" and all its items will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await L.deleteList(active.id);
          } catch (e) {
            Alert.alert('Could not delete', (e && e.message) || 'Please try again.');
          }
        },
      },
    ]);
  };

  const doDuplicate = async () => {
    if (!active) return;
    try {
      await L.duplicateList(active.id);
    } catch (e) {
      Alert.alert('Could not duplicate', (e && e.message) || 'Please try again.');
    }
  };

  const doClearDone = () => {
    if (!active) return;
    if (stats.done === 0) {
      Alert.alert('Nothing to clear', 'No items are checked off yet.');
      return;
    }
    Alert.alert('Clear finished items?', 'Checked items will be removed. You can undo this.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => L.mutate(active.id, (items) => clearDone(items)) },
    ]);
  };

  const submitPrompt = (v) => {
    const p = prompt;
    setPrompt(null);
    if (!p || !active) return;
    if (p.kind === 'edit') L.mutate(active.id, (items) => updateItem(items, p.item.id, (x) => ({ ...x, text: v.trim(), mins: null })));
    if (p.kind === 'sub') L.mutate(active.id, (items) => updateItem(items, p.item.id, (x) => ({ ...x, done: false, children: [...x.children, newItem(v)] })));
    if (p.kind === 'rename') L.renameList(active.id, v.trim());
    if (p.kind === 'bulk') {
      const lines = v.split('\n').map((s) => s.replace(/^[\s\-*•\d.)\[\]xX]+/, '').trim()).filter(Boolean);
      if (!lines.length) {
        Alert.alert('No items found', 'Put each item on its own line.');
        return;
      }
      L.mutate(active.id, (items) => [...items, ...lines.map(newItem)]);
    }
  };

  const itemActions = menuFor
    ? [
        { label: 'Edit text', icon: 'create-outline', onPress: () => setPrompt({ kind: 'edit', item: menuFor, title: 'Edit item', value: menuFor.text, confirm: 'Save' }) },
        { label: 'Add sub-step', icon: 'add-circle-outline', onPress: () => setPrompt({ kind: 'sub', item: menuFor, title: 'Add a sub-step', value: '', confirm: 'Add' }) },
        ...(menuFor.children.length === 0 && !menuFor.done ? [{ label: 'Break it down', icon: 'color-wand-outline', onPress: () => breakItem(active.id, menuFor) }] : []),
        { label: 'Move up', icon: 'arrow-up-outline', onPress: () => L.mutate(active.id, (items) => moveItem(items, menuFor.id, -1)) },
        { label: 'Move down', icon: 'arrow-down-outline', onPress: () => L.mutate(active.id, (items) => moveItem(items, menuFor.id, 1)) },
        { label: 'Delete', icon: 'trash-outline', danger: true, onPress: () => confirmDelete(menuFor) },
      ]
    : [];

  const toolActions = [
    { label: 'Rename list', icon: 'pencil-outline', onPress: () => active && setPrompt({ kind: 'rename', title: 'Rename list', value: active.name, confirm: 'Rename' }) },
    { label: 'Duplicate list', icon: 'copy-outline', onPress: doDuplicate },
    { label: 'Clear finished items', icon: 'checkmark-done-outline', onPress: doClearDone },
    { label: 'Delete list', icon: 'trash-outline', danger: true, onPress: doDeleteList },
  ];

  const working = busy.all || busy.est || busy.create;

  const headerRight = (
    <IconButton
      icon="color-wand"
      label="Break down every open item"
      bg={t.accent}
      color={t.onAccent}
      borderColor={t.accent}
      size={46}
      disabled={!active || !!working}
      onPress={breakAll}
    />
  );

  const footer = (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <IconButton icon="share-social" label="Share list" onPress={shareList} size={52} disabled={!active} />
      <View style={{ flex: 1 }} />
      <IconButton icon="funnel" label={hideDone ? 'Show finished items' : 'Hide finished items'} active={hideDone} onPress={() => { tick(); setHideDone((h) => !h); }} size={52} disabled={!active} />
      <IconButton icon="arrow-undo" label="Undo" onPress={() => { tick(); L.undo(L.activeId); }} disabled={!L.canUndo} size={52} style={{ marginLeft: 8 }} />
      <IconButton icon="arrow-redo" label="Redo" onPress={() => { tick(); L.redo(L.activeId); }} disabled={!L.canRedo} size={52} style={{ marginLeft: 8 }} />
    </View>
  );

  const body = () => {
    if (L.loading) {
      return <ActivityIndicator style={{ marginTop: 40 }} color={t.accent} />;
    }
    if (L.lists.length === 0) {
      return (
        <View style={{ alignItems: 'center', paddingTop: 24, paddingHorizontal: 12 }}>
          <View style={{ width: 84, height: 84, borderRadius: 28, backgroundColor: TOOL.color + '2A', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkbox-outline" size={42} color={TOOL.color} />
          </View>
          <Text style={[t.font.heading, { color: t.text, marginTop: 16, textAlign: 'center' }]}>No lists yet</Text>
          <Text style={[t.font.callout, { color: t.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 20 }]}>
            Start with something that feels too big, like "Do the laundry". Magic will cut it into small steps.
          </Text>
          <Btn title="Create your first list" icon="add" onPress={() => setNewOpen(true)} loading={!!busy.create} style={{ alignSelf: 'stretch' }} />
          <ErrorNote message={L.loadError} onRetry={L.reload} />
        </View>
      );
    }
    return (
      <>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Add new item..."
            placeholderTextColor={t.textMuted}
            returnKeyType="done"
            onSubmitEditing={onAdd}
            style={[t.font.body, { flex: 1, height: 52, borderRadius: 16, paddingHorizontal: 16, color: t.text, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border }]}
          />
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel="Add item"
            style={({ pressed }) => ({ width: 52, height: 52, borderRadius: 16, marginLeft: 8, backgroundColor: blue, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}
          >
            <Ionicons name="add" size={30} color="#FFFFFF" />
          </Pressable>
          <Pressable
            onPress={() => { tick(); setSpiceOpen(true); }}
            accessibilityRole="button"
            accessibilityLabel={`Spiciness ${active ? active.spice : 3} of 5`}
            style={({ pressed }) => ({ height: 52, paddingHorizontal: 10, borderRadius: 16, marginLeft: 8, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}
          >
            <FlameRow level={active ? active.spice : 3} size={14} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, flexGrow: 0 }} contentContainerStyle={{ alignItems: 'center' }}>
          {L.lists.map((l) => {
            const on = l.id === L.activeId;
            return (
              <Pressable
                key={l.id}
                onPress={() => { tick(); L.setActiveId(l.id); }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 16, borderRadius: 14, marginRight: 8, justifyContent: 'center', backgroundColor: on ? t.accent : t.surface, borderWidth: 1, borderColor: on ? strong : t.border, opacity: pressed ? 0.75 : 1 })}
              >
                <Text style={[t.font.body, { color: on ? t.onAccent : t.text }]} numberOfLines={1}>{l.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
          <IconButton icon="add" label="New list" onPress={() => { tick(); setNewOpen(true); }} size={48} />
          <View style={{ flex: 1 }} />
          <IconButton icon="list" label="Add several items" onPress={() => setPrompt({ kind: 'bulk', title: 'Add several items', value: '', confirm: 'Add items', multiline: true, placeholder: 'One item per line' })} size={48} disabled={!active} />
          <View style={{ width: 8 }} />
          {busy.est ? (
            <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={t.accent} /></View>
          ) : (
            <IconButton icon="time-outline" label="Estimate time for open items" onPress={estimate} size={48} disabled={!active} />
          )}
          <View style={{ width: 8 }} />
          <IconButton icon="hammer" label="List tools" onPress={() => setToolsOpen(true)} size={48} disabled={!active} />
        </View>

        {busy.all || busy.create ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
            <ActivityIndicator color={t.accent} />
            <Text style={[t.font.subhead, { color: t.textMuted, marginLeft: 8 }]}>{busy.create ? 'Making your list…' : 'Breaking things down…'}</Text>
          </View>
        ) : null}

        {active && stats.total > 0 ? (
          <Text style={[t.font.footnote, { color: t.textMuted, marginTop: 12 }]}>
            {`${stats.done} of ${stats.total} done${stats.minsLeft > 0 ? `  ·  about ${formatMins(stats.minsLeft)} left` : ''}`}
          </Text>
        ) : null}

        <View style={{ marginTop: 8 }}>
          {active && active.items.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 28 }}>
              <Text style={[t.font.body, { color: t.textMuted, textAlign: 'center', marginBottom: 16 }]}>This list is empty. Add an item above, or let Magic suggest steps for "{active.name}".</Text>
              <Btn title="Break down the list name" icon="color-wand" variant="blue" onPress={fillFromName} loading={!!busy.fill} />
            </View>
          ) : rows.length === 0 ? (
            <Text style={[t.font.body, { color: t.textMuted, textAlign: 'center', paddingVertical: 28 }]}>Everything here is finished. Turn off the filter to see it.</Text>
          ) : (
            rows.map(({ item, depth }) => (
              <View
                key={item.id}
                style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingLeft: depth * 22, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }}
              >
                <Pressable
                  onPress={() => toggle(item)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.done }}
                  accessibilityLabel={item.text}
                  style={{ width: 44, height: 48, alignItems: 'center', justifyContent: 'center' }}
                >
                  <View style={{ width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: item.done ? strong : t.textMuted, backgroundColor: item.done ? strong : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {item.done ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
                  </View>
                </Pressable>
                <Pressable
                  style={{ flex: 1, paddingVertical: 10, paddingRight: 6 }}
                  onPress={() => setPrompt({ kind: 'edit', item, title: 'Edit item', value: item.text, confirm: 'Save' })}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${item.text}`}
                >
                  <Text style={[t.font.body, { color: item.done ? t.textMuted : t.text, textDecorationLine: item.done ? 'line-through' : 'none' }]}>{item.text}</Text>
                  {typeof item.mins === 'number' && !item.done ? (
                    <Text style={[t.font.caption, { color: t.textMuted, marginTop: 2 }]}>{`about ${formatMins(item.mins)}`}</Text>
                  ) : null}
                </Pressable>
                <Ionicons name={iconFor(item.text)} size={20} color={t.textMuted} style={{ marginHorizontal: 6 }} />
                {!item.done && item.children.length === 0 ? (
                  busy[item.id] ? (
                    <View style={{ width: 48, height: 44, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={blue} /></View>
                  ) : (
                    <Pressable
                      onPress={() => breakItem(active.id, item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Break down ${item.text}`}
                      style={({ pressed }) => ({ width: 48, height: 40, borderRadius: 12, borderWidth: 1.5, borderColor: blue, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
                    >
                      <Ionicons name="color-wand" size={20} color={blue} />
                    </Pressable>
                  )
                ) : null}
                <Pressable
                  onPress={() => { tick(); setMenuFor(item); }}
                  accessibilityRole="button"
                  accessibilityLabel={`More options for ${item.text}`}
                  style={{ width: 44, height: 48, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="ellipsis-vertical" size={20} color={t.textMuted} />
                </Pressable>
              </View>
            ))
          )}
        </View>
        {L.saveError ? <ErrorNote message={`Saved on this device only: ${L.saveError}`} /> : null}
      </>
    );
  };

  return (
    <Screen scroll={false} padded={false}>
      <ToolFrame insetTop={false} style={{ flex: 1 }} title={TOOL.title} subtitle={TOOL.subtitle} help={TOOL.help} headerRight={headerRight} footer={L.lists.length ? footer : null}>
        {body()}
      </ToolFrame>

      <ActionSheetModal visible={!!menuFor} title={menuFor ? menuFor.text : ''} actions={itemActions} onClose={() => setMenuFor(null)} />
      <ActionSheetModal visible={toolsOpen} title={active ? active.name : 'List tools'} actions={toolActions} onClose={() => setToolsOpen(false)} />
      <ActionSheetModal
        visible={spiceOpen}
        title="How spicy? More flames, tinier steps"
        actions={SPICE.map((s) => ({
          label: `${s.name} · ${s.note}`,
          icon: s.level >= 4 ? 'flame' : 'flame-outline',
          selected: active ? active.spice === s.level : false,
          onPress: () => { if (active) { tick(); L.setSpice(active.id, s.level); } },
        }))}
        onClose={() => setSpiceOpen(false)}
      />
      <TextPrompt
        visible={!!prompt}
        title={prompt ? prompt.title : ''}
        value={prompt ? prompt.value : ''}
        placeholder={prompt && prompt.placeholder}
        multiline={prompt ? !!prompt.multiline : false}
        confirmLabel={prompt ? prompt.confirm : 'Save'}
        onCancel={() => setPrompt(null)}
        onSubmit={submitPrompt}
      />
      <TextPrompt
        visible={newOpen}
        title="New list"
        value=""
        placeholder="e.g. Do the laundry"
        confirmLabel="Create"
        onCancel={() => setNewOpen(false)}
        onSubmit={createList}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, marginTop: 8 }}>
          <Text style={[t.font.body, { color: t.text, flex: 1 }]}>Break it down into steps</Text>
          <Switch value={newBreak} onValueChange={(v) => { tick(); setNewBreak(v); }} trackColor={{ true: t.accent }} />
        </View>
      </TextPrompt>
    </Screen>
  );
}
