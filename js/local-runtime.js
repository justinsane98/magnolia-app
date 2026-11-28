/* Local runtime for the Magnolia bid board.
 *
 * The pages were first built as claude.ai artifacts, which give them two
 * globals: `dash` (datasets + calculations) and `claude.use(...)` (a shared
 * database, file uploads, the signed-in user, downloads). This file provides
 * the same globals backed by server.py and the JSON files in ./data, so the
 * page code runs unchanged and every edit lands in the git repo.
 */
(function () {
  'use strict';

  const json = async (url, opts) => {
    const r = await fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
    if (!r.ok) { const e = new Error((await r.text()) || r.statusText); e.status = r.status; throw e; }
    return r.json();
  };
  const columnsOf = (rows) => {
    const cols = [];
    (Array.isArray(rows) ? rows : []).slice(0, 50).forEach((r) => {
      if (r && typeof r === 'object') Object.keys(r).forEach((k) => { if (!cols.includes(k)) cols.push(k); });
    });
    return cols;
  };

  // ------------------------------------------------------------------ dash
  const store = {};        // dataset id -> result
  const calcs = {};        // calc id -> {inputs, fn, title, description, res}
  const calcOrder = [];
  const listeners = [];
  let params = {};
  let fireTimer = null;

  function fire() {
    clearTimeout(fireTimer);
    fireTimer = setTimeout(() => {
      recompute();
      listeners.forEach((fn) => { try { fn(); } catch (e) { console.error('dash.onData', e); } });
    }, 0);
  }
  async function load(id, refreshing) {
    const prev = store[id];
    store[id] = refreshing && prev && prev.status === 'ok'
      ? Object.assign({}, prev, { refreshing: true })
      : { status: 'loading', data: [], columns: [], meta: [], refreshing: false };
    try {
      const rows = await json('/api/data/' + encodeURIComponent(id));
      store[id] = { status: 'ok', data: rows, columns: columnsOf(rows), meta: [], refreshing: false };
    } catch (e) {
      store[id] = { status: e.status === 404 ? 'missing' : 'error', data: [], columns: [], meta: [], message: String(e.message || e), refreshing: false };
    }
    fire();
  }
  function get(id) {
    if (calcs[id]) return calcs[id].res || { status: 'loading', data: [], columns: [], meta: [] };
    if (!store[id]) load(id);
    return store[id];
  }
  function recompute() {
    calcOrder.forEach((id) => {
      const c = calcs[id];
      const ins = c.inputs.map((i) => get(i));
      if (ins.every((x) => x.status === 'ok')) {
        try {
          const v = c.fn.apply(null, ins.map((x) => x.data));
          c.res = { status: 'ok', data: v, columns: columnsOf(v), meta: [] };
        } catch (e) { console.error('dash.calc ' + id, e); c.res = { status: 'error', data: [], columns: [], meta: [], message: String(e) }; }
      } else if (ins.some((x) => x.status === 'error' || x.status === 'missing')) {
        c.res = { status: 'error', data: [], columns: [], meta: [], message: 'an input failed to load' };
      } else c.res = { status: 'loading', data: [], columns: [], meta: [] };
    });
  }

  window.dash = {
    data: get,
    onData(fn) { listeners.push(fn); try { fn(); } catch (e) { console.error('dash.onData', e); } },
    calc(id, spec) { if (!calcs[id]) calcOrder.push(id); calcs[id] = Object.assign({ res: null }, spec); spec.inputs.forEach((i) => { if (!calcs[i]) get(i); }); recompute(); },
    loader() { /* queries are not used locally */ },
    refresh(id) { return load(id, true); },
    colors: ['#73213b', '#006b46', '#b07a1e', '#2f6690', '#8e5572', '#5c7457', '#c26a2d', '#6f777b'],
    params: () => Object.assign({}, params),
    setParams(p) { params = Object.assign({}, params, p); fire(); },
    resetParams() { params = {}; fire(); },
    setLink() {},
  };
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - lastW) > 4) { lastW = window.innerWidth; fire(); } });

  // ------------------------------------------------------------ claude.use
  const blobs = new Map();   // uploaded JSON waiting to be saved as a dataset
  const COL = { pipeline: 'pipeline', portals: 'portal_logins' };
  const watchers = {};       // collection -> {subs:[], last:''}

  async function pull(col) {
    const w = watchers[col]; if (!w) return;
    let res;
    try { res = await json('/api/col/' + col); } catch (e) { w.subs.forEach((s) => s.err && s.err(e)); return; }
    const sig = JSON.stringify(res.docs);
    if (sig === w.last) return;
    w.last = sig;
    const snap = { docs: res.docs.map((d) => ({ id: d.id, data: () => d.data })) };
    w.subs.forEach((s) => { try { s.cb(snap); } catch (e) { console.error(e); } });
  }
  function collection(name) {
    const col = COL[name] || name;
    const docRef = (id) => ({
      id,
      async set(data) {
        if (id) await json('/api/col/' + col + '/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(data) });
        else { const r = await json('/api/col/' + col, { method: 'POST', body: JSON.stringify({ data }) }); id = r.id; }
        pull(col);
      },
      async update(patch) { await json('/api/col/' + col + '/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(patch) }); pull(col); },
      async delete() { await json('/api/col/' + col + '/' + encodeURIComponent(id), { method: 'DELETE' }); pull(col); },
      async get() { const r = await json('/api/col/' + col); const d = r.docs.find((x) => x.id === id); return { id, exists: !!d, data: () => (d ? d.data : undefined) }; },
    });
    return {
      doc: (id) => docRef(id || null),
      onSnapshot(cb, err) {
        const w = watchers[col] || (watchers[col] = { subs: [], last: '', timer: null });
        const sub = { cb, err }; w.subs.push(sub);
        w.last = ''; pull(col);
        if (!w.timer) w.timer = setInterval(() => { if (!document.hidden) pull(col); }, 8000);
        return () => { w.subs = w.subs.filter((s) => s !== sub); };
      },
    };
  }
  const db = {
    collection,
    doc(path) {
      const m = /^datasets\/([A-Za-z0-9_-]+)$/.exec(path);
      return {
        async update(patch) {
          if (!m) throw new Error('unsupported doc ' + path);
          const id = (((patch || {}).source || {}).url || '').replace('/_blob/', '');
          if (!blobs.has(id)) throw new Error('nothing uploaded for ' + path);
          await json('/api/data/' + m[1], { method: 'PUT', body: blobs.get(id) });
          blobs.delete(id);
          await load(m[1], true);
        },
      };
    },
  };
  const assets = {
    async upload(blob) { const id = 'local' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); blobs.set(id, await blob.text()); return { id, url: '/_blob/' + id }; },
  };
  const whoKey = 'mg-who';
  const user = {
    async canEdit() { return true; },
    async can() { return true; },
    async me() { let n = ''; try { n = localStorage.getItem(whoKey) || ''; } catch (e) {} return { name: n || 'Local' }; },
  };
  const downloads = {
    async save({ filename, data }) {
      const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = filename || 'download';
      document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    },
  };
  const caps = { db, assets, user, downloads };
  window.claude = Object.assign(window.claude || {}, { use: async (name) => caps[name] || null });

  // ------------------------------------------- open bid -> pipeline (MGP)
  const today = () => new Date().toISOString().slice(0, 10);
  const MGP = {
    rows: null,
    waiting: [],
    idFor: (key) => 'bid-' + String(key).toLowerCase(),
    has(r) { return !!(this.rows && this.rows.some((p) => p.id === this.idFor(r.key) || p.source === r.key)); },
    card(r) {
      const notes = [r.description, r.requirements && r.requirements !== 'None listed' ? 'Requirements: ' + r.requirements : '', r.sol_no && r.sol_no !== 'N/A' ? 'No. ' + r.sol_no : '',
        r.contact_name || r.contact_email || r.contact_phone ? 'Contact: ' + [r.contact_name, r.contact_phone, r.contact_email].filter(Boolean).join(', ') : ''].filter(Boolean).join('\n');
      return { name: r.title, agency: r.agency || '', county: r.county || '', due: r.due || '', prebid: '', link: /^https?:/.test(r.link || '') ? r.link : '',
        notes, owner: '', bid_amount: '', result: '', source: r.key, stage: 'watching', created: new Date().toISOString(), updated: new Date().toISOString() };
    },
    async add(r) {
      await json('/api/col/pipeline', { method: 'POST', body: JSON.stringify({ id: this.idFor(r.key), data: this.card(r) }) }).catch((e) => { if (e.status !== 409) throw e; });
      await this.refresh();
    },
    async refresh() {
      try { const res = await json('/api/col/pipeline'); this.rows = res.docs.map((d) => Object.assign({ id: d.id }, d.data)); } catch (e) { this.rows = this.rows || []; }
      document.querySelectorAll('[data-mgp]').forEach((b) => this.paint(b));
      try { window.dispatchEvent(new Event('mgp')); } catch (e) {}
    },
    paint(b) {
      const inP = this.rows && this.rows.some((p) => p.id === b.dataset.mgp || p.source === b.dataset.key);
      b.textContent = inP ? 'In pipeline ✓' : '+ Add to pipeline';
      b.classList.toggle('in', !!inP); b.disabled = false;
      b.title = inP ? 'Open the pipeline' : 'Add this bid to the pipeline as Watching';
    },
    button(r) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mgp-add';
      b.dataset.mgp = this.idFor(r.key); b.dataset.key = r.key; this.paint(b);
      b.addEventListener('click', async (e) => {
        e.preventDefault(); e.stopPropagation();
        if (b.classList.contains('in')) { location.href = '/pipeline#card=' + encodeURIComponent(b.dataset.mgp); return; }
        b.disabled = true; b.textContent = 'Adding…';
        try { await this.add(r); } catch (err) { console.error(err); b.disabled = false; b.textContent = 'Couldn’t add. Try again'; }
      });
      return b;
    },
    isOpen: (r) => !r.missed_prebid && !r.gc_lead && (r.status === 'rolling' || (r.due && r.due >= today())),
  };
  window.MGP = MGP;
  MGP.refresh();
  setInterval(() => { if (!document.hidden) MGP.refresh(); }, 15000);
})();
