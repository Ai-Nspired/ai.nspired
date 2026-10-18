let counter = 0;

export const newId = () => `i${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const newItem = (text) => ({ id: newId(), text: String(text || '').trim(), done: false, mins: null, children: [] });

export function normalize(items) {
  return (Array.isArray(items) ? items : [])
    .filter(Boolean)
    .map((i) => ({
      id: String(i.id || newId()),
      text: String(i.text || ''),
      done: !!i.done,
      mins: typeof i.mins === 'number' ? i.mins : null,
      children: normalize(i.children),
    }));
}

export function cloneTree(items) {
  return (items || []).map((i) => ({ ...i, id: newId(), children: cloneTree(i.children) }));
}

export function updateItem(items, id, fn) {
  return items.map((it) => {
    if (it.id === id) return fn(it);
    if (it.children.length) return { ...it, children: updateItem(it.children, id, fn) };
    return it;
  });
}

export function setDoneDeep(item, done) {
  return { ...item, done, children: item.children.map((c) => setDoneDeep(c, done)) };
}

export function syncDone(items) {
  return items.map((it) => {
    if (!it.children.length) return it;
    const kids = syncDone(it.children);
    return { ...it, children: kids, done: kids.every((k) => k.done) };
  });
}

export function removeItem(items, id) {
  return items.filter((i) => i.id !== id).map((i) => ({ ...i, children: removeItem(i.children, id) }));
}

export function moveItem(items, id, dir) {
  const idx = items.findIndex((i) => i.id === id);
  if (idx >= 0) {
    const to = idx + dir;
    if (to < 0 || to >= items.length) return items;
    const copy = items.slice();
    const [x] = copy.splice(idx, 1);
    copy.splice(to, 0, x);
    return copy;
  }
  return items.map((i) => ({ ...i, children: moveItem(i.children, id, dir) }));
}

export function clearDone(items) {
  return items.filter((i) => !i.done).map((i) => ({ ...i, children: clearDone(i.children) }));
}

export function flatten(items, hideDone, depth = 0, out = []) {
  items.forEach((it) => {
    if (hideDone && it.done) return;
    out.push({ item: it, depth });
    flatten(it.children, hideDone, depth + 1, out);
  });
  return out;
}

export function leaves(items, out = []) {
  items.forEach((it) => {
    if (it.children.length) leaves(it.children, out);
    else out.push(it);
  });
  return out;
}

export function applyMins(items, map) {
  return items.map((it) => {
    if (it.children.length) return { ...it, children: applyMins(it.children, map) };
    return map[it.id] != null ? { ...it, mins: map[it.id] } : it;
  });
}

export function countAll(items) {
  const l = leaves(items || []);
  const done = l.filter((x) => x.done).length;
  const minsLeft = l.filter((x) => !x.done && typeof x.mins === 'number').reduce((s, x) => s + x.mins, 0);
  return { done, total: l.length, minsLeft };
}

export function toText(name, items) {
  const lines = [name];
  flatten(items || [], false).forEach(({ item, depth }) => {
    lines.push(`${'  '.repeat(depth)}${item.done ? '[x]' : '[ ]'} ${item.text}`);
  });
  return lines.join('\n');
}

export function formatMins(m) {
  const n = Math.max(0, Math.round(m || 0));
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const r = n % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

const ICONS = [
  [/laundry|wash|clothes|iron|fold|dryer/, 'shirt-outline'],
  [/clean|sweep|mop|dust|vacuum|tidy|bin|trash|dish/, 'sparkles-outline'],
  [/cook|dinner|lunch|breakfast|meal|eat|recipe|kitchen|bake/, 'restaurant-outline'],
  [/buy|shop|grocer|store|order|pick up/, 'cart-outline'],
  [/call|phone|ring/, 'call-outline'],
  [/mail|email|reply|message|text|send/, 'mail-outline'],
  [/pay|bill|bank|tax|budget|money|invoice/, 'cash-outline'],
  [/doctor|dentist|pill|med|appointment|health|clinic/, 'medkit-outline'],
  [/write|note|draft|journal|pocket|plan|list/, 'create-outline'],
  [/read|study|learn|book|homework|essay/, 'book-outline'],
  [/timer|alarm|remind|wake|schedule|clock/, 'alarm-outline'],
  [/car|drive|fuel|commute|bus|train/, 'car-outline'],
  [/work|code|computer|laptop|report|meeting|slides/, 'laptop-outline'],
  [/friend|family|party|visit|invite|people/, 'people-outline'],
  [/walk|run|gym|exercise|workout|stretch/, 'fitness-outline'],
  [/pack|trip|flight|travel|book hotel/, 'airplane-outline'],
  [/dog|cat|pet|feed/, 'paw-outline'],
  [/fix|repair|tool|build|assemble/, 'construct-outline'],
  [/sort|file|folder|put away|organi[sz]e|document|paper/, 'folder-outline'],
  [/home|house|room|garden|plant|water/, 'home-outline'],
];

export function iconFor(text) {
  const s = String(text || '').toLowerCase();
  for (let i = 0; i < ICONS.length; i += 1) {
    if (ICONS[i][0].test(s)) return ICONS[i][1];
  }
  return 'ellipse-outline';
}
