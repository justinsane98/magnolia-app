/* Shared top bar: every section of the bid board, Pipeline on the far right. */
(function () {
  const bar = document.querySelector('.topbar'); if (!bar) return;
  const page = bar.dataset.page;                    // 'index' | 'portals' | 'pipeline'
  const onIndex = page === 'index';
  const here = location.pathname.replace(/^\/|\/$/g, '');
  const cur = onIndex ? (here === 'open-bids' ? 'bids' : (here || 'overview')) : page;
  const a = (href, text, key, count) => {
    const x = document.createElement('a'); x.href = href; x.textContent = text;
    if (['overview', 'bids', 'work', 'relationships'].includes(key)) x.dataset.pane = key;
    if (count) { const n = document.createElement('span'); n.className = 'n'; n.id = 'n-' + key; n.textContent = '–'; x.append(n); }
    if (key === cur) x.setAttribute('aria-current', 'page');
    return x;
  };
  const nav = document.createElement('nav'); nav.setAttribute('aria-label', 'Sections');
  const home = a('/', '', 'overview');               // Overview is a house icon; the label stays for screen readers
  home.className = 'home'; home.title = 'Overview'; home.setAttribute('aria-label', 'Overview');
  home.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  nav.append(home, a('/bids', 'Bids', 'bids', true), a('/work', 'Work', 'work'),
    a('/relationships', 'Relationships', 'relationships'), a('/registrations', 'Registrations', 'portals'), a('/storms', 'Storms', 'storms'), a('/areas', 'Areas', 'areas'), a('/network', 'Network', 'network'));
  const sp = document.createElement('span'); sp.className = 'spacer';
  const nav2 = document.createElement('nav'); nav2.className = 'right'; nav2.setAttribute('aria-label', 'Pipeline');
  nav2.append(a('/pipeline', 'Pipeline', 'pipeline', true));
  const sbox = document.createElement('div'); sbox.className = 'gsearch'; sbox.setAttribute('role', 'search');
  sbox.innerHTML = '<input type="search" id="gsearch-q" placeholder="Search everything  /" aria-label="Search bids, pipeline, relationships, work and registrations" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="gsearch-res"><div class="gsearch-res" id="gsearch-res" role="listbox" hidden></div>';
  bar.append(nav, sp, sbox, nav2);
  search(sbox);

  const today = new Date().toISOString().slice(0, 10);
  async function counts() {
    try {
      const [opps, pipe, hidden] = await Promise.all([fetch('/api/data/opps').then((r) => r.json()), fetch('/api/col/pipeline').then((r) => r.json()), fetch('/api/data/hidden').then((r) => r.json()).catch(() => [])]);
      const gone = new Set(hidden.map((h) => h.id));   // same rule as the Bids page: hidden bids don't count
      document.getElementById('n-bids').textContent = opps.filter((r) => !gone.has('opps:' + r.key) && (!r.missed_prebid && !r.gc_lead && (r.status === 'rolling' || (r.due && r.due >= today)))).length;
      document.getElementById('n-pipeline').textContent = pipe.docs.filter((d) => ['watching', 'going', 'submitted'].includes(d.data.stage || 'watching')).length;
    } catch (e) { /* counts are optional */ }
  }
  counts(); setInterval(() => { if (!document.hidden) counts(); }, 15000);

  /* ---- Search everything: bids, pipeline cards, relationships, work signals, registrations, county bid pages ---- */
  function search(box) {
    const q = box.querySelector('input'), res = box.querySelector('.gsearch-res');
    let idx = null, loadedAt = 0, loading = null, sel = -1, items = [], expanded = {};
    const norm = (t) => String(t == null ? '' : t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9#&.@-]+/g, ' ');
    const j = (u) => fetch(u).then((r) => r.ok ? r.json() : []).catch(() => []);
    const fmt = (d) => { if (!/^\d{4}-\d\d-\d\d/.test(d || '')) return ''; const x = new Date(d.slice(0, 10) + 'T12:00:00'); return x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: x.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }); };
    const STAGE = { watching: 'Watching', going: 'Going to bid', submitted: 'Submitted', won: 'Won', closed: 'Lost / passed' };
    const REG = ['Not registered', 'Registered', 'Registered + alerts'];
    async function load() {
      if (idx && Date.now() - loadedAt < 30000) return idx;
      if (loading) return loading;
      loading = (async () => {
        const [opps, targets, signals, buyers, pipe, regs] = await Promise.all(['/api/data/opps', '/api/data/targets', '/api/data/signals', '/api/data/buyers', '/api/col/pipeline', '/api/col/portal_logins'].map(j));
        const cards = (pipe.docs || []).map((d) => Object.assign({ id: d.id }, d.data));
        const bySource = {}; cards.forEach((c) => { if (c.source) bySource[c.source] = c; });
        const L = [];
        const add = (group, o) => { o.group = group; o.t = norm(o.title); o.h = o.t + ' ' + norm(o.hay.join(' ')); delete o.hay; L.push(o); };
        cards.forEach((c) => add('Pipeline', { title: c.name || c.id, sub: [STAGE[c.stage || 'watching'], c.agency, c.due ? 'due ' + fmt(c.due) : ''].filter(Boolean).join(' · '), href: '/bid/' + encodeURIComponent(c.id),
          boost: ['watching', 'going', 'submitted'].includes(c.stage || 'watching') ? 3 : 0,
          hay: [c.agency, c.county, c.sol_no, c.owner, c.notes, c.result, c.link, (c.facts || []).map((f) => f.v).join(' '), (c.tasks || []).map((t) => t.text).join(' ')] }));
        const today = new Date().toISOString().slice(0, 10);
        (Array.isArray(opps) ? opps : []).forEach((o) => { const open = !o.missed_prebid && !o.gc_lead && (o.status === 'rolling' || (o.due && o.due >= today)), c = bySource[o.key];
          const fresh = /^\d{4}-\d\d-\d\d/.test(o.added || '') && (Date.now() - Date.parse(o.added.slice(0, 10) + 'T12:00:00')) < 8 * 864e5;
          add('Bids', { title: o.title, sub: [fresh ? 'NEW' : '', o.agency, o.county ? o.county + ' Co.' : '', o.due ? (open ? 'due ' : 'closed ') + fmt(o.due) : (o.status || ''), c ? 'in pipeline' : ''].filter(Boolean).join(' · '),
            href: c ? '/bid/' + encodeURIComponent(c.id) : '/bids#bid-' + o.key, ext: /^https?:/.test(o.link || '') ? o.link : '', boost: open ? 2 : -1,
            hay: [o.key, o.agency, o.county, o.region, o.sol_no, o.description, o.requirements, o.contact_name, o.contact_email, o.address, o.type, o.fit, o.found_in] }); });
        (Array.isArray(targets) ? targets : []).forEach((t) => add('Relationships', { title: t.org, sub: [t.group, t.county ? t.county + ' Co.' : t.region, t.contact_name].filter(Boolean).join(' · '),
          href: '/relationships#org=' + encodeURIComponent(t.key), ext: /^https?:/.test(t.url || '') ? t.url : '', boost: String(t.priority) === '1' ? 1 : 0,
          hay: [t.org_type, t.county, t.region, t.why, t.how_to_get_in, t.recent_signal, t.contact_name, t.contact_title, t.email, t.phone, t.address, t.url] }));
        (Array.isArray(signals) ? signals : []).forEach((g) => add('Work', { title: g.title, sub: [g.signal_type, g.org, g.county ? g.county + ' Co.' : '', g.planned_year ? 'planned ' + g.planned_year : ''].filter(Boolean).join(' · '),
          href: '/work#sig-' + encodeURIComponent(g.key), ext: /^https?:/.test(g.url || '') ? g.url : '', boost: g.stale === 'yes' ? -1 : 0,
          hay: [g.org, g.org_type, g.county, g.region, g.est_value, g.notes] }));
        (regs.docs || []).forEach((d) => { const r = d.data;
          add('Registrations', { title: r.name || d.id, sub: [REG[Math.min(2, r.status | 0)], r.where].filter(Boolean).join(' · '), href: '/registrations#reg=' + encodeURIComponent(d.id),
            ext: /^https?:/.test(r.url || '') ? r.url : '', boost: 1, hay: [r.where, r.url, r.platform, r.scope, r.notes, r.login, r.tip, (r.match || []).join(' ')] }); });
        (Array.isArray(buyers) ? buyers : []).forEach((b) => { if (!/^https?:/.test(b.bid_page_url || '')) return;
          add('County bid pages', { title: b.agency, sub: [b.county ? b.county + ' Co.' : '', b.posts_on].filter(Boolean).join(' · '), href: b.bid_page_url, external: true, boost: -1,
            hay: [b.county, b.region, b.agency_type, b.posts_on, b.notes] }); });
        idx = L; loadedAt = Date.now(); loading = null; return L;
      })();
      return loading;
    }
    const ORDER = ['Pipeline', 'Bids', 'Registrations', 'Relationships', 'Work', 'County bid pages'];
    function find(L, text) {
      const words = norm(text).split(' ').filter(Boolean); if (!words.length) return [];
      const whole = words.join(' ');
      return L.filter((x) => words.every((w) => x.h.includes(w))).map((x) => {
        let s = x.boost; if (x.t.includes(whole)) s += 10; if (x.t.startsWith(whole)) s += 4;
        words.forEach((w) => { if (x.t.includes(w)) s += 2; if ((' ' + x.t).includes(' ' + w)) s += 1; });
        return { x, s };
      }).sort((a, b) => b.s - a.s || a.x.title.localeCompare(b.x.title)).map((r) => r.x);
    }
    const mk = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
    function hl(text, words) {   // bold the matched words in a title, without innerHTML
      const span = mk('span', 't'); const low = text.toLowerCase().replace(/[^a-z0-9#&.@-]/g, ' '); const marks = new Array(text.length).fill(false);
      if (low.length === text.length) words.forEach((w) => { let i = low.indexOf(w); while (w && i >= 0) { for (let k = i; k < i + w.length; k++) marks[k] = true; i = low.indexOf(w, i + w.length); } });
      let buf = '', on = false; const flush = () => { if (!buf) return; span.append(on ? mk('mark', null, buf) : document.createTextNode(buf)); buf = ''; };
      for (let i = 0; i < text.length; i++) { if (marks[i] !== on) { flush(); on = marks[i]; } buf += text[i]; } flush();
      return span;
    }
    async function run() {
      const text = q.value.trim();
      if (!text) { close(); return; }
      const L = await load(); if (q.value.trim() !== text) return;
      const hits = find(L, text), words = norm(text).split(' ').filter(Boolean);
      res.replaceChildren(); items = []; sel = -1;
      if (!hits.length) { res.append(mk('p', 'none', 'Nothing matches “' + text + '”.')); }
      ORDER.forEach((g) => {
        const gh = hits.filter((x) => x.group === g); if (!gh.length) return;
        const sec = mk('section'); const h = mk('h3'); h.append(mk('span', null, g), mk('span', 'c', String(gh.length))); sec.append(h);
        const lim = expanded[g] ? gh.length : 5;
        gh.slice(0, lim).forEach((x) => {
          const row = mk('div', 'r'); const a = mk('a', 'go'); a.href = x.href; a.setAttribute('role', 'option');
          if (x.external) { a.target = '_blank'; a.rel = 'noopener'; }
          a.append(hl(x.title, words)); if (x.sub) a.append(mk('span', 's', x.sub));
          row.append(a);
          if (x.ext) { const e = mk('a', 'ext', '↗'); e.href = x.ext; e.target = '_blank'; e.rel = 'noopener'; e.title = 'Open the posting / website'; e.tabIndex = -1; row.append(e); }
          if (x.external) row.append(mk('span', 'ext ghost', '↗'));
          sec.append(row); items.push(a);
        });
        if (gh.length > lim) { const m = mk('button', 'more', 'Show all ' + gh.length + ' ' + g.toLowerCase()); m.type = 'button'; m.addEventListener('mousedown', (e) => e.preventDefault()); m.addEventListener('click', () => { expanded[g] = true; run(); q.focus(); }); sec.append(m); }
        res.append(sec);
      });
      res.hidden = false; q.setAttribute('aria-expanded', 'true');
      if (items.length) move(0);
    }
    function move(i) { if (!items.length) return; items.forEach((x) => x.classList.remove('on')); sel = (i + items.length) % items.length; items[sel].classList.add('on'); items[sel].scrollIntoView({ block: 'nearest' }); }
    function close() { res.hidden = true; q.setAttribute('aria-expanded', 'false'); }
    let tm = null;
    q.addEventListener('input', () => { expanded = {}; clearTimeout(tm); tm = setTimeout(run, 90); });
    q.addEventListener('focus', () => { load(); if (q.value.trim()) run(); });
    q.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(sel + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(sel - 1); }
      else if (e.key === 'Enter') { if (sel >= 0 && items[sel] && !res.hidden) { e.preventDefault(); items[sel].click(); close(); } }
      else if (e.key === 'Escape') { if (!res.hidden) close(); else { q.value = ''; q.blur(); } }
    });
    res.addEventListener('click', (e) => { if (e.target.closest('a.go')) setTimeout(close, 0); });
    document.addEventListener('mousedown', (e) => { if (!box.contains(e.target)) close(); });
    document.addEventListener('keydown', (e) => {   // "/" or Cmd/Ctrl+K jumps to search from anywhere
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) || e.target.isContentEditable;
      if ((e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); q.focus(); q.select(); }
    });
  }
})();
