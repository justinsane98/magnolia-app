/* Pipeline page: "Start from an open bid" picker that fills the add form. */
(function () {
  const sel = document.getElementById('pick-open'), form = document.getElementById('add-form');
  if (!sel || !form) return;
  const today = new Date().toISOString().slice(0, 10);
  const fmt = (d) => { const x = new Date(d + 'T12:00:00'); return isNaN(x) ? d : x.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
  let open = [];

  function fill() {
    const inP = (r) => MGP.has(r);
    const cur = sel.value;
    sel.replaceChildren(new Option('— Pick an open bid, or leave this and fill in your own below —', ''));
    let avail = 0;
    open.forEach((r) => {
      const o = new Option((r.due ? 'Due ' + fmt(r.due) : 'Rolling') + ' · ' + r.title + (r.county ? ' — ' + r.county : '') + (inP(r) ? '  (already in pipeline)' : ''), r.key);
      o.disabled = inP(r); if (!o.disabled) avail++;
      sel.append(o);
    });
    sel.value = cur && !sel.querySelector('option[value="' + cur + '"]:disabled') ? cur : '';
    document.getElementById('pick-n').textContent = '(' + avail + ' not in the pipeline yet)';
    // names in the "What is it" box autocomplete to open bids too
    window.KNOWN = open.map((r) => ({ name: r.title, agency: r.agency, county: r.county, due: r.due, link: /^https?:/.test(r.link || '') ? r.link : '' }));
    const dl = document.getElementById('known');
    if (dl) { dl.replaceChildren(); open.forEach((r) => dl.append(new Option(r.title))); }
  }
  async function load() {
    try {
      const rows = await fetch('/api/data/opps').then((r) => r.json());
      open = rows.filter((r) => !r.missed_prebid && !r.gc_lead && (r.status === 'rolling' || (r.due && r.due >= today))).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
      await MGP.refresh(); fill();
    } catch (e) { sel.replaceChildren(new Option('Couldn’t load open bids', '')); }
  }
  sel.addEventListener('change', () => {
    const r = open.find((x) => x.key === sel.value);
    const set = (n, v) => { const f = form.elements[n]; if (f) f.value = v || ''; };
    if (!r) { ['name', 'agency', 'county', 'due', 'prebid', 'link', 'notes', 'source'].forEach((n) => set(n, '')); return; }
    const c = MGP.card(r);
    set('name', c.name); set('agency', c.agency); set('county', c.county); set('due', c.due); set('prebid', '');
    set('link', c.link); set('notes', c.notes); set('source', r.key);
    let who = ''; try { who = localStorage.getItem('mg-who') || ''; } catch (e) {}
    if (who && form.elements.owner && !form.elements.owner.value) form.elements.owner.value = who;
  });
  window.MGPick = { after: () => { sel.value = ''; form.elements.source.value = ''; form.elements.notes.value = ''; MGP.refresh().then(fill); } };
  load();
  setInterval(() => { if (!document.hidden) MGP.refresh().then(fill); }, 15000);
})();
