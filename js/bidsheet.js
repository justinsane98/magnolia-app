// ---- Bid prep sheet: a printable PDF for one pipeline card (meeting day, site walks, questions, schedule) ----
// Uses the PDF writer in fieldsheet.js (window.MGPDF). Maps are drawn on a canvas from Esri tiles.
(() => {
  const W = window;
  const TILES = {
    street: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/',
    sat: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/',
    satLabels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/',
  };
  const T = 256;
  const wx = (lon, z) => (lon + 180) / 360 * T * 2 ** z;
  const wy = (lat, z) => { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * T * 2 ** z; };
  const miles = (a, b) => { const R = 3958.8, r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lon - a.lon) * r; const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  // one retry with a cache-buster: a tile cached without CORS headers fails the first time
  const loadImg = (src, retry = true) => new Promise((ok) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = () => (retry ? loadImg(src + (src.includes('?') ? '&' : '?') + 'r=' + Date.now(), false).then(ok) : ok(null)); i.src = src; });

  // Draws a map around the points. opt: {w, h, z (fixed zoom, centered on center) | fit, base, labels}
  async function tileMap(points, opt) {
    const w = opt.w, h = opt.h;
    let z = opt.z, cx, cy;
    if (z == null) {   // fit every point with some padding
      for (z = 18; z > 3; z--) {
        const xs = points.map((p) => wx(p.lon, z)), ys = points.map((p) => wy(p.lat, z));
        if (Math.max(...xs) - Math.min(...xs) < w * 0.7 && Math.max(...ys) - Math.min(...ys) < h * 0.62) break;
      }
      z = Math.min(z, opt.zmax || 16);
      const xs = points.map((p) => wx(p.lon, z)), ys = points.map((p) => wy(p.lat, z));
      cx = (Math.max(...xs) + Math.min(...xs)) / 2; cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    } else { cx = wx(opt.center.lon, z); cy = wy(opt.center.lat, z); }
    const x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);   // whole pixels, so tiles meet without seams
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = '#e9eaee'; g.fillRect(0, 0, w, h);
    const layer = async (url) => {
      const jobs = [];
      for (let tx = Math.floor(x0 / T); tx <= Math.floor((x0 + w) / T); tx++)
        for (let ty = Math.floor(y0 / T); ty <= Math.floor((y0 + h) / T); ty++)
          jobs.push(loadImg(url + z + '/' + ty + '/' + tx).then((im) => { if (im) g.drawImage(im, tx * T - x0, ty * T - y0); }));
      await Promise.all(jobs);
    };
    await layer(TILES[opt.base || 'street']);
    if (opt.labels) await layer(TILES.satLabels);
    // pins: magenta circle with a letter, name tag beside it
    const S = w / 1000;   // scale marks to the canvas size
    points.forEach((p) => {
      const px = wx(p.lon, z) - x0, py = wy(p.lat, z) - y0, r = 17 * S;
      g.beginPath(); g.arc(px, py, r, 0, 2 * Math.PI); g.fillStyle = p.color || '#73213b'; g.fill();
      g.lineWidth = 3.5 * S; g.strokeStyle = '#fff'; g.stroke();
      g.fillStyle = '#fff'; g.font = `bold ${20 * S}px Helvetica, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.letter, px, py + 1 * S);
      if (p.tag) {
        g.font = `bold ${17 * S}px Helvetica, Arial, sans-serif`; g.textAlign = 'left';
        const tw = g.measureText(p.tag).width, bx = px + r + 6 * S, by = py - 13 * S, bw = tw + 14 * S, bh = 26 * S;
        const left = p.side === 'left' || bx + bw > w - 4;   // left when asked (pins close together) or near the edge
        const X = left ? px - r - 6 * S - bw : bx;
        g.fillStyle = 'rgba(255,255,255,.93)'; g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1 * S;
        g.beginPath(); if (g.roundRect) g.roundRect(X, by, bw, bh, 6 * S); else g.rect(X, by, bw, bh); g.fill(); g.stroke();
        g.fillStyle = '#2b2326'; g.fillText(p.tag, X + 7 * S, py + 0.5 * S);
      }
    });
    // scale bar, bottom left
    const mpp = 156543.03392 * Math.cos(((points[0] || opt.center).lat) * Math.PI / 180) / 2 ** z;   // meters per pixel
    const ft = mpp * 3.28084, choices = [50, 100, 200, 500, 1000, 2640, 5280, 10560, 26400, 52800];
    const pick = choices.filter((f) => f / ft <= w * 0.22).pop() || choices[0], bar = pick / ft;
    const lab = pick >= 5280 ? (pick / 5280) + ' mi' : pick === 2640 ? '½ mi' : pick + ' ft';
    g.fillStyle = 'rgba(255,255,255,.88)'; g.fillRect(10 * S, h - 40 * S, bar + 70 * S, 30 * S);
    g.fillStyle = '#2b2326'; g.fillRect(18 * S, h - 22 * S, bar, 5 * S);
    g.font = `${15 * S}px Helvetica, Arial, sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(lab, 24 * S + bar, h - 20 * S);
    return {w, h, z, data: atob(c.toDataURL('image/jpeg', 0.88).split(',')[1])};
  }

  // storm reports near each site: hail 1"+ and damaging wind within `mi` miles, last `yrs` years
  async function stormsNear(places, mi = 3, yrs = 10) {
    try {
      const j = await (await fetch('/storms/sc-storms.json')).json();
      const from = new Date(Date.now() - yrs * 365.25 * 864e5).toISOString().slice(0, 10);
      return places.map((p) => {
        const near = j.r.filter((r) => r[0] >= from && (r[1] === 'h' ? r[2] >= 1 : true) && Math.abs(r[3] - p.lat) < 0.1 && Math.abs(r[4] - p.lon) < 0.12)
          .map((r) => ({date: r[0], type: r[1], mag: r[2], mi: miles(p, {lat: r[3], lon: r[4]}), note: r[8]})).filter((r) => r.mi <= mi)
          .sort((a, b) => b.date.localeCompare(a.date));
        return {place: p, near};
      });
    } catch (e) { return null; }
  }

  const fmtLong = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});
  const fmtShort = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC'});
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const magTxt = (r) => r.type === 'h' ? r.mag + '" hail' : r.type === 'w' ? (r.mag > 0 ? r.mag + ' mph wind' : 'wind damage') : 'tornado' + (r.mag >= 0 ? ' (EF' + r.mag + ')' : '');

  // card: the pipeline card. extras: {logo, overview, sites: [{place, map}], storms}
  function build(card, ex) {
    const {Doc, tw} = W.MGPDF;
    const d = Doc(); const {ML, CW} = d; const X2 = ML + CW;
    d.MB = 44; d.img = ex.logo || null;
    d.onPage = (n) => { if (n > 1) d.y = d.PH - 64; };
    const L = (runs, size, lead, color, width = CW, x = ML) => { const ln = d.wrap(Array.isArray(runs) ? runs : [{t: runs}], size, width); d.need(ln.length * lead); d.y -= d.drawLines(ln, x, d.y, size, lead, color); };
    let first = true;
    const section = (name, sub, room = 80) => {
      if (!first) d.y -= 14; first = false;
      d.need(room);
      d.text(ML, d.y, name, {size: 13, bold: true, color: 'mag'}); d.y -= 5; d.hline(ML, X2, d.y, 'mag', 0.9); d.y -= 12;
      if (sub) { L(sub, 8, 10.5, 'slate'); d.y -= 5; }
    };
    const check = (runs, note, size = 9) => {   // checkbox line
      const ln = d.wrap(Array.isArray(runs) ? runs : [{t: runs}], size, CW - 18), nl = note ? d.wrap([{t: note}], 7.5, CW - 18) : [];
      d.need(ln.length * (size + 2.5) + nl.length * 9.5 + 4);
      d.box(ML, d.y - 1.5, 8.5, 8.5, 'slate', 0.8);
      d.y -= d.drawLines(ln, ML + 16, d.y, size, size + 2.5, 'ink');
      if (nl.length) d.y -= d.drawLines(nl, ML + 16, d.y + 1, 7.5, 9.5, 'slate');
      d.y -= 4;
    };
    const t0 = today();
    const places = card.places || [];
    const meet = places.find((p) => /meeting|office/i.test(p.role || '')) || null;

    // ---- page 1: what, when, where ----
    d.page();
    const top = d.y;
    if (d.img) { const w = Math.min(190, 40 * d.img.w / d.img.h); d.image(ML, top - w * d.img.h / d.img.w + 6, w, w * d.img.h / d.img.w); }
    else d.text(ML, top - 14, 'Magnolia Roofing & Remodeling', {size: 14, bold: true, color: 'mag'});
    const dt = 'Prepared ' + fmtLong(t0).replace(/^\w+, /, ''); d.text(X2 - tw(dt, false, 8), top - 8, dt, {size: 8, color: 'slate'});
    d.y = top - 62;
    d.text(ML, d.y, 'BID PREP SHEET', {size: 8, bold: true, color: 'slate'}); d.y -= 20;
    d.y -= d.drawLines(d.wrap([{t: card.name, bold: true}], 19, CW), ML, d.y, 19, 22, 'ink');
    L([card.agency, card.county ? card.county + ' County' : '', card.sol_no ? 'No. ' + card.sol_no : ''].filter(Boolean).join(' · '), 9.5, 12, 'slate');
    d.y -= 10;
    // date boxes
    const boxes = [];
    if (card.prebid) boxes.push(['PRE-BID MEETING', fmtLong(card.prebid.slice(0, 10)), [card.prebid_time || (card.prebid.length > 10 ? card.prebid.slice(11, 16) : ''), meet ? meet.addr : ''].filter(Boolean).join(' · ')]);
    if (card.due) boxes.push(['BID DUE', fmtLong(card.due), [card.due_time, card.deliver_to || (meet ? meet.addr : '')].filter(Boolean).join(' · ')]);
    if (boxes.length) {
      const gap = 10, bw = (CW - gap * (boxes.length - 1)) / boxes.length, bh = 50;
      boxes.forEach(([k, v, s], i) => {
        const x = ML + i * (bw + gap);
        d.rrect(x, d.y - bh, bw, bh, 7, i === 0 ? 'tint' : 'mist');
        d.text(x + 12, d.y - 14, k, {size: 7, bold: true, color: 'mag'});
        d.text(x + 12, d.y - 29, v, {size: 12.5, bold: true, color: 'ink'});
        d.text(x + 12, d.y - 42, s, {size: 8, color: 'body'});
      });
      d.y -= bh + 12;
    }
    if (card.alert) {
      const ln = d.wrap([{t: 'Go / no-go: ', bold: true, color: 'amber'}, {t: card.alert}], 8.5, CW - 22);
      const bh = ln.length * 11 + 12; d.rrect(ML, d.y - bh, CW, bh, 7, 'ambertint');
      d.drawLines(ln, ML + 11, d.y - 14, 8.5, 11, 'body'); d.y -= bh + 12;
    }
    if (ex.overview && places.length) {
      const M = ex.overview, legendH = places.length * 22 + 20;
      const avail = d.y - d.MB - legendH;
      const mw = Math.min(CW, avail * M.w / M.h), mh = mw * M.h / M.w;
      d.extra.push({name: 'Ov', w: M.w, h: M.h, data: M.data});
      d.image(ML + (CW - mw) / 2, d.y - mh, mw, mh, 'Ov'); d.y -= mh + 14;
      places.forEach((p, i) => {
        d.need(22);
        d.circle(ML + 7, d.y + 3, 7, 'mag'); d.text(ML + 7 - tw(p.letter, true, 8) / 2, d.y + 0.2, p.letter, {size: 8, bold: true, color: 'white'});
        const prev = i ? places[i - 1] : null;
        const dist = prev ? '  ·  ' + miles(prev, p).toFixed(1) + ' mi straight-line from ' + prev.letter : '';
        d.text(ML + 20, d.y, p.name, {size: 9.5, bold: true, color: 'ink'});
        d.text(ML + 20 + tw(p.name, true, 9.5) + 6, d.y, p.addr + dist, {size: 8, color: 'slate'});
        if (p.what) { d.y -= 10.5; d.text(ML + 20, d.y, p.what, {size: 8, color: 'body'}); }
        d.y -= 14;
      });
    }

    // ---- site walks: satellite close-up of each site + what to check ----
    (ex.sites || []).forEach((s, i) => {
      d.page(); first = true;
      section(s.place.letter + '  ' + s.place.name, s.place.addr + (s.place.what ? ' · ' + s.place.what : ''));
      if (s.map) {
        const M = s.map, mw = CW, mh = Math.min(mw * M.h / M.w, 330);
        d.extra.push({name: 'Site' + i, w: M.w, h: M.h, data: M.data});
        d.image(ML, d.y - mh, mh * M.w / M.h, mh, 'Site' + i); d.y -= mh + 6;
        L('Satellite view (Esri World Imagery); the pin is the street address, so the buildings may sit a little off it. Write building numbers on the roofs as you find them.', 7.5, 9.5, 'slate');
        d.y -= 8;
      }
      if (s.place.notes) { L([{t: 'From the bid set: ', bold: true}, {t: s.place.notes}], 8.5, 11, 'body'); d.y -= 6; }
      const bl = s.place.buildings || [];
      if (bl.length) {
        d.need(30 + bl.length * 20);
        // columns: the place can set its own (e.g. low-slope roof sections); default is the shingle walk sheet
        const C2 = s.place.cols || [['Bldg', 40], ['Pitch', 42], ['Layers', 42], ['Squares', 50], ['Boots / vents', 70], ['Deck / fascia / gutters', 200], ['Photos', 72]];
        const cols = C2.map((c) => c[0]), cw = C2.map((c) => c[1]);
        let x = ML; cols.forEach((c, j) => { d.text(x + 3, d.y, c, {size: 7.5, bold: true, color: 'slate'}); x += cw[j]; });
        d.y -= 5; d.hline(ML, X2, d.y, 'slate', 0.6);
        bl.forEach((b) => { d.y -= 18; d.text(ML + 3, d.y + 5, String(b), {size: 9, bold: true, color: 'ink'}); d.hline(ML, X2, d.y, 'line', 0.6); });
        d.y -= 14;
      }
      const walk = s.place.walk || card.walk || [];
      if (walk.length) { d.text(ML, d.y, 'Check on every building', {size: 9.5, bold: true, color: 'ink'}); d.y -= 13; walk.forEach((w) => check(w, null, 8.5)); }
    });

    // ---- at the meeting ----
    d.page(); first = true;
    const meeting = card.meeting || [];
    if (meeting.length) {
      section('At the meeting', 'Verbal answers don\'t bind the owner. Anything that matters has to come back in a written addendum.');
      meeting.forEach((m) => check(m.t || m, m.n || null));
    }
    // ---- gameplan notes (non-question lines in Notes) ----
    const plan = String(card.notes || '').split(/\n\s*\n/).filter((b) => !/^\s*QUESTIONS/i.test(b) && !/^\s*\d+\./.test(b)).map((b) => b.trim()).filter(Boolean);
    if (plan.length) { section('Gameplan'); plan.forEach((b) => { const m = b.match(/^([A-Z][A-Z /&-]+):\s*(.*)$/s); L(m ? [{t: m[1] + ': ', bold: true}, {t: m[2]}] : b, 9, 12, 'body'); d.y -= 6; }); }

    // ---- questions, with room to write the answer ----
    const qs = String(card.notes || '').split('\n').map((s) => s.match(/^\s*(\d+)\.\s+(.*)$/)).filter(Boolean);
    if (qs.length) {
      const head = String(card.notes).split('\n').find((s) => /questions/i.test(s));
      section('Questions to ask', (head ? head.replace(/:$/, '').replace(/^QUESTIONS FOR\s+([^(]+)/i, (m, n) => 'For ' + n.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) + ' ').trim() + '. ' : '') + 'Ask at the meeting, then send them in writing so the answers come back in an addendum.');
      qs.forEach(([, n, q]) => {
        const ln = d.wrap([{t: q}], 9, CW - 20);
        d.need(ln.length * 11.5 + 30);
        d.text(ML, d.y, n + '.', {size: 9, bold: true, color: 'mag'});
        d.y -= d.drawLines(ln, ML + 20, d.y, 9, 11.5, 'ink');
        d.y -= 14; d.hline(ML + 20, X2, d.y, 'line', 0.7); d.y -= 14; d.hline(ML + 20, X2, d.y, 'line', 0.7); d.y -= 13;
      });
    }
    // ---- schedule ----
    const tl = (card.timeline || []).slice();
    if (card.due && !tl.some((m) => m.date === card.due)) tl.push({date: card.due, label: 'Bid due' + (card.due_time ? ' ' + card.due_time : ''), hard: true});
    tl.sort((a, b) => a.date.localeCompare(b.date));
    if (tl.length) {
      section('Schedule', 'Bold = hard deadline. Dates before today are greyed out.', 40 + tl.length * 15);
      tl.forEach((m) => {
        const past = m.date < t0, col = past ? 'slate' : 'ink';
        d.need(15);
        if (m.hard && !past) d.circle(ML + 4, d.y + 3, 3.5, 'red'); else d.circle(ML + 4, d.y + 3, 2.6, past ? 'line' : 'slate');
        d.text(ML + 14, d.y, fmtShort(m.date) + (m.time ? ' ' + m.time : ''), {size: 9, bold: !!m.hard, color: past ? 'slate' : 'mag'});
        const ln = d.wrap([{t: m.label, bold: !!m.hard && !past}], 9, CW - 104);
        d.y -= d.drawLines(ln, ML + 104, d.y, 9, 11.5, col) + 3.5;
      });
    }
    // ---- storm history at the sites ----
    if (ex.storms && ex.storms.length) {
      section('Storm history at the sites', 'NOAA reports of hail 1"+ and damaging wind within ' + ex.stormMi + ' miles of each address, last ' + ex.stormYrs + ' years. Good context for roof age and wear; not proof of damage.');
      ex.storms.forEach(({place, near}) => {
        const hail = near.filter((r) => r.type === 'h'), wind = near.filter((r) => r.type !== 'h');
        const lastH = hail[0], big = hail.reduce((m, r) => Math.max(m, r.mag), 0);
        L([{t: place.letter + '  ' + place.name + ': ', bold: true}, {t: near.length ? hail.length + ' hail report' + (hail.length === 1 ? '' : 's') + (lastH ? ' (latest ' + fmtLong(lastH.date).replace(/^\w+, /, '') + ', ' + lastH.mag + '"; largest ' + big + '")' : '') + ', ' + wind.length + ' wind/tornado report' + (wind.length === 1 ? '' : 's') + '.' : 'no reports on file.'}], 9, 12, 'body');
        near.slice(0, 5).forEach((r) => L('   ' + fmtLong(r.date).replace(/^\w+, /, '') + ' · ' + magTxt(r) + ' · ' + r.mi.toFixed(1) + ' mi away', 8, 10, 'slate'));
        d.y -= 5;
      });
    }
    // ---- key facts ----
    if ((card.facts || []).length) {
      section('Key facts');
      card.facts.forEach(({k, v}) => {
        const vv = String(v || '').replace(/https?:\/\/\S+/g, (u) => u.length > 60 ? u.replace(/^https?:\/\/(www\.)?/, '').split(/[/?#]/)[0] + ' (link on the bid page)' : u);
        const ln = d.wrap([{t: vv}], 8.5, CW - 96); d.need(ln.length * 11 + 4);
        d.text(ML, d.y, k, {size: 8.5, bold: true, color: 'slate'});
        d.y -= d.drawLines(ln, ML + 96, d.y, 8.5, 11, 'body') + 4;
      });
    }
    // ---- checklist, open items by phase ----
    const open = (card.tasks || []).filter((t) => !t.done);
    if (open.length) {
      section('Checklist', open.length + ' open of ' + (card.tasks || []).length + ' tasks. MUST = hard requirement.');
      const phases = [...new Set(open.map((t) => t.phase || 'Other'))];
      phases.forEach((ph) => {
        d.need(40); d.y -= 2; d.text(ML, d.y, ph, {size: 9.5, bold: true, color: 'ink'}); d.y -= 13;
        open.filter((t) => (t.phase || 'Other') === ph).forEach((t) => check([{t: (t.hard ? 'MUST ' : ''), bold: true, color: 'red'}, {t: t.text}, {t: t.due ? '  ·  ' + fmtShort(t.due) : '', color: 'slate'}], t.note && !/^https?:/.test(t.note) ? t.note : null, 8.8));
        d.y -= 4;
      });
    }
    // ---- blank page for notes ----
    d.page(); first = true;
    section('Meeting notes', 'Who else showed up, what was said, anything to follow up on.');
    d.text(ML, d.y, 'Other bidders at the pre-bid:', {size: 9, bold: true, color: 'ink'}); d.y -= 8;
    for (let i = 0; i < 6; i++) { d.y -= 20; d.hline(ML, X2, d.y, 'line', 0.7); }
    d.y -= 26; d.text(ML, d.y, 'Notes:', {size: 9, bold: true, color: 'ink'}); d.y -= 8;
    while (d.y - 20 > d.MB) { d.y -= 20; d.hline(ML, X2, d.y, 'line', 0.7); }

    // ---- running header on pages 2+ ----
    const N = d.pages.length;
    d.pages.forEach((p, i) => {
      if (!i) return; d.cur = p;
      const h = 'Magnolia Roofing & Remodeling · ' + card.name; d.text(ML, d.PH - 36, h, {size: 7.5, color: 'slate'});
      const pg = 'Page ' + (i + 1) + ' of ' + N; d.text(X2 - tw(pg, false, 7.5), d.PH - 36, pg, {size: 7.5, color: 'slate'});
      d.hline(ML, X2, d.PH - 42, 'line', 0.5);
    });
    return d.bytes({title: card.name + ' · bid prep', author: 'Magnolia Roofing & Remodeling'});
  }

  async function logoJpeg() {
    const img = await loadImg('/img/logo.webp') || document.querySelector('.brand .logo, .brand img');
    const im = img && img.naturalWidth ? img : null; if (!im) return null;
    const s = Math.min(1, 900 / im.naturalWidth), cw = Math.round(im.naturalWidth * s), ch = Math.round(im.naturalHeight * s);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch); g.drawImage(im, 0, 0, cw, ch);
    return {w: cw, h: ch, data: atob(c.toDataURL('image/jpeg', 0.92).split(',')[1])};
  }

  // Builds and downloads the PDF. status(text) reports progress.
  async function download(card, status = () => {}) {
    const places = (card.places || []).filter((p) => isFinite(p.lat) && isFinite(p.lon));
    const ex = {stormMi: 3, stormYrs: 10};
    status('Drawing maps…');
    ex.logo = await logoJpeg().catch(() => null);
    if (places.length) {
      ex.overview = await tileMap(places.map((p) => ({...p, tag: p.short || p.name})), {w: 1600, h: 1000, base: 'street', zmax: 15}).catch(() => null);
      ex.sites = await Promise.all(places.filter((p) => p.walk || (p.buildings || []).length).map(async (p) => ({place: p, map: await tileMap([{...p, tag: ''}], {w: 1500, h: 950, z: 18, center: p, base: 'sat', labels: true}).catch(() => null)})));
      status('Checking storm history…');
      ex.storms = await stormsNear(places.filter((p) => (p.buildings || []).length), ex.stormMi, ex.stormYrs);
    }
    status('Building PDF…');
    const bytes = build(card, ex);
    const now = new Date(), stamp = [now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, '0')).join('-') + '-' + now.getFullYear();
    const name = ('magnolia prep ' + card.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-' + stamp + '.pdf';
    const blob = new Blob([bytes], {type: 'application/pdf'});
    const dl = W.claude && typeof W.claude.use === 'function' ? await W.claude.use('downloads').catch(() => null) : null;
    if (dl) await dl.save({filename: name, data: blob});
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); }
    return name;
  }
  W.MGBidSheet = {download, build, tileMap};
})();
