import { useCallback, useEffect, useRef, useState } from 'react';
import { saveRecord, listRecords, updateRecord, deleteRecord, syncPending } from '../lib/wron-db';
import { onAuthChange } from '../lib/wron-auth';
import { normalize, syncDone, cloneTree } from '../lib/todoTree';

const TABLE = 'todo_lists';

const clampSpice = (n) => Math.max(1, Math.min(5, Math.round(Number(n)) || 3));

function parseItems(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

function fromRow(r) {
  return {
    id: String(r.id),
    name: r.name || 'Untitled list',
    spice: clampSpice(r.spice),
    items: normalize(parseItems(r.items)),
  };
}

export default function useTodoLists(defaultSpice = 3) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [hist, setHist] = useState({});
  const listsRef = useRef([]);
  const chain = useRef({});

  const commit = useCallback((next) => {
    listsRef.current = next;
    setLists(next);
  }, []);

  const load = useCallback(async () => {
    try {
      const rows = await listRecords(TABLE, { orderBy: 'created_at', descending: false });
      const next = (rows || []).map(fromRow);
      commit(next);
      setActiveId((cur) => (next.some((l) => l.id === cur) ? cur : next[0] ? next[0].id : null));
      setLoadError('');
    } catch (e) {
      setLoadError((e && e.message) || 'Could not load your lists.');
    } finally {
      setLoading(false);
    }
  }, [commit]);

  useEffect(() => {
    let alive = true;
    const off = onAuthChange(async (u) => {
      if (!alive) return;
      try {
        if (u) await syncPending();
      } catch (e) {
        // the lists below still load whatever is available
      }
      if (alive) load();
    });
    return () => {
      alive = false;
      if (typeof off === 'function') off();
    };
  }, [load]);

  const persist = useCallback((id, values) => {
    const prev = chain.current[id] || Promise.resolve();
    chain.current[id] = prev
      .then(() => updateRecord(TABLE, id, values))
      .then(
        () => setSaveError(''),
        (e) => setSaveError((e && e.message) || 'Could not save your changes.')
      );
  }, []);

  const apply = useCallback(
    (id, items) => {
      commit(listsRef.current.map((l) => (l.id === id ? { ...l, items } : l)));
      persist(id, { items });
    },
    [commit, persist]
  );

  const mutate = useCallback(
    (id, fn) => {
      const cur = listsRef.current.find((l) => l.id === id);
      if (!cur) return;
      const next = syncDone(fn(cur.items));
      setHist((h) => {
        const e = h[id] || { past: [], future: [] };
        return { ...h, [id]: { past: [...e.past.slice(-29), cur.items], future: [] } };
      });
      apply(id, next);
    },
    [apply]
  );

  const undo = (id) => {
    const e = hist[id];
    const cur = listsRef.current.find((l) => l.id === id);
    if (!e || !e.past.length || !cur) return;
    const prev = e.past[e.past.length - 1];
    setHist((h) => ({ ...h, [id]: { past: e.past.slice(0, -1), future: [cur.items, ...e.future] } }));
    apply(id, prev);
  };

  const redo = (id) => {
    const e = hist[id];
    const cur = listsRef.current.find((l) => l.id === id);
    if (!e || !e.future.length || !cur) return;
    const next = e.future[0];
    setHist((h) => ({ ...h, [id]: { past: [...e.past, cur.items], future: e.future.slice(1) } }));
    apply(id, next);
  };

  const addList = useCallback(
    async (name, spice) => {
      const values = { name: String(name).trim(), spice: clampSpice(spice || defaultSpice), items: [] };
      const row = await saveRecord(TABLE, values);
      const list = fromRow({ ...values, ...row, name: values.name, spice: values.spice, items: [] });
      commit([...listsRef.current, list]);
      setActiveId(list.id);
      return list;
    },
    [commit, defaultSpice]
  );

  const renameList = useCallback(
    (id, name) => {
      commit(listsRef.current.map((l) => (l.id === id ? { ...l, name } : l)));
      persist(id, { name });
    },
    [commit, persist]
  );

  const setSpice = useCallback(
    (id, spice) => {
      const s = clampSpice(spice);
      commit(listsRef.current.map((l) => (l.id === id ? { ...l, spice: s } : l)));
      persist(id, { spice: s });
    },
    [commit, persist]
  );

  const duplicateList = useCallback(
    async (id) => {
      const src = listsRef.current.find((l) => l.id === id);
      if (!src) return null;
      const values = { name: `${src.name} (copy)`, spice: src.spice, items: cloneTree(src.items) };
      const row = await saveRecord(TABLE, values);
      const list = fromRow({ ...values, ...row, name: values.name, spice: values.spice, items: values.items });
      commit([...listsRef.current, list]);
      setActiveId(list.id);
      return list;
    },
    [commit]
  );

  const deleteList = useCallback(
    async (id) => {
      const before = listsRef.current;
      const rest = before.filter((l) => l.id !== id);
      commit(rest);
      setActiveId((cur) => (cur === id ? (rest[0] ? rest[0].id : null) : cur));
      try {
        await deleteRecord(TABLE, id);
      } catch (e) {
        commit(before);
        throw new Error((e && e.message) || 'Could not delete that list.');
      }
    },
    [commit]
  );

  const entry = hist[activeId] || { past: [], future: [] };

  return {
    lists,
    loading,
    loadError,
    saveError,
    activeId,
    setActiveId,
    reload: load,
    mutate,
    addList,
    renameList,
    setSpice,
    duplicateList,
    deleteList,
    undo,
    redo,
    canUndo: entry.past.length > 0,
    canRedo: entry.future.length > 0,
  };
}
