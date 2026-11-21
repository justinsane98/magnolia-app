// ---- Field sheet: a small PDF writer (Helvetica, WinAnsi), no libraries ----
(() => {
  const W = window;
  const WH = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,350,556,350,222,556,333,1000,556,556,333,1000,667,333,1000,350,611,350,350,222,222,333,333,350,556,1000,333,1000,500,333,944,350,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500];
const WB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,350,556,350,278,556,500,1000,556,556,333,1000,667,333,1000,350,611,350,350,278,278,500,500,350,556,1000,333,1000,556,333,944,350,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556];

  const WIN = {0x20ac: 0x80, 0x201a: 0x82, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x2122: 0x99};
  const enc = (s) => {
    let o = '';
    for (const ch of String(s == null ? '' : s).replace(/\s+/g, ' ')) {
      const c = ch.codePointAt(0);
      if (c >= 32 && c < 127) o += ch;
      else if (c >= 160 && c < 256) o += String.fromCharCode(c);
      else if (WIN[c]) o += String.fromCharCode(WIN[c]);
      else if (c === 0x2192) o += '->';
      else o += '?';
    }
    return o;
  };
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const tw = (s, bold, size) => { const T = bold ? WB : WH; let w = 0; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); w += (c >= 32 && c < 256 ? T[c - 32] : 556) || 556; } return w * size / 1000; };
  const hex = (h) => { h = h.replace('#', ''); return [0, 2, 4].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)).join(' '); };
  const C = {ink: hex('2b2326'), body: hex('3e3e3e'), slate: hex('6f777b'), mag: hex('73213b'), leaf: hex('006b46'), red: hex('b3261e'), line: hex('e3e6ec'), mist: hex('f3f4f7'), tint: hex('f6ecef'), leaftint: hex('e6f2ed'), amber: hex('8a5a00'), ambertint: hex('fbf3e2'), conbg: hex('fbecea'), contx: hex('9b2c22'), white: '1 1 1', blue: hex('1e88e5'), green: hex('2e7d32'), orange: hex('f57c00'), hot: hex('c2185b'), gc: hex('2f5d9b'), sig: hex('b06a00'), white: hex('ffffff')};
  // score circle colors, same as the Focus list on the page
  const TIER = {4: ['leaf', 'white'], 3: ['leaftint', 'leaf'], 2: ['ambertint', 'amber'], 1: ['mist', 'slate']};

  function Doc() {
    const PW = 612, PH = 792, ML = 48, MR = 48, MT = 48, MB = 58;
    const d = {PW, PH, ML, MR, MT, MB, CW: PW - ML - MR, pages: [], y: 0, img: null};
    d.page = () => { d.cur = {ops: [], links: []}; d.pages.push(d.cur); d.y = PH - MT; if (d.onPage) d.onPage(d.pages.length); };
    d.text = (x, y, s, o = {}) => { const size = o.size || 10; d.cur.ops.push(`BT /${o.bold ? 'F2' : 'F1'} ${size} Tf ${C[o.color || 'body']} rg ${x.toFixed(2)} ${y.toFixed(2)} Td (${esc(enc(s))}) Tj ET`); };
    d.rect = (x, y, w, h, color) => d.cur.ops.push(`${C[color]} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
    d.rrect = (x, y, w, h, r, color) => { // rounded rectangle
      const k = 0.5523 * r, X = x + w, Y = y + h;
      d.cur.ops.push(`${C[color]} rg ${x + r} ${y} m ${X - r} ${y} l ${X - r + k} ${y} ${X} ${y + r - k} ${X} ${y + r} c ${X} ${Y - r} l ${X} ${Y - r + k} ${X - r + k} ${Y} ${X - r} ${Y} c ${x + r} ${Y} l ${x + r - k} ${Y} ${x} ${Y - r + k} ${x} ${Y - r} c ${x} ${y + r} l ${x} ${y + r - k} ${x + r - k} ${y} ${x + r} ${y} c f`);
    };
    d.circle = (cx, cy, r, color) => { const k = 0.5523 * r; d.cur.ops.push(`${C[color]} rg ${cx + r} ${cy} m ${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} c ${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} c ${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} c ${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} c f`); };
    d.tri = (cx, cy, r, color) => d.cur.ops.push(`${C[color]} rg ${(cx).toFixed(2)} ${(cy - r).toFixed(2)} m ${(cx + r * .95).toFixed(2)} ${(cy + r * .7).toFixed(2)} l ${(cx - r * .95).toFixed(2)} ${(cy + r * .7).toFixed(2)} l h f`);   // points down
    d.box = (x, y, w, h, color = 'slate', lw = 0.8) => d.cur.ops.push(`${C[color]} RG ${lw} w ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);   // outline only
    d.hline = (x1, x2, y, color = 'line', lw = 0.75) => d.cur.ops.push(`${C[color]} RG ${lw} w ${x1.toFixed(2)} ${y.toFixed(2)} m ${x2.toFixed(2)} ${y.toFixed(2)} l S`);
    d.link = (x1, y1, x2, y2, url) => d.cur.links.push({r: [x1, y1, x2, y2].map((v) => v.toFixed(2)).join(' '), url});
    d.extra = [];   // more images beyond the logo: {name, w, h, data}
    d.image = (x, y, w, h, name = 'Im1') => d.cur.ops.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /${name} Do Q`);
    // rich text: runs [{t, bold, color}] wrapped to width; returns lines of runs
    d.wrap = (runs, size, width) => {
      const words = [];
      runs.forEach((r) => enc(r.t).split(' ').forEach((w, i, a) => { if (w !== '' || (i > 0 && i < a.length - 1)) words.push({t: w, bold: !!r.bold, color: r.color}); }));
      const lines = []; let line = [], lw = 0;
      const space = (b) => tw(' ', b, size);
      words.forEach((w) => {
        let ww = tw(w.t, w.bold, size);
        if (ww > width) { // hard-break very long tokens (URLs)
          let s = w.t;
          while (s.length) { let n = s.length; while (n > 1 && tw(s.slice(0, n), w.bold, size) > width - (line.length ? lw + space(w.bold) : 0)) n--; if (line.length && tw(s.slice(0, n), w.bold, size) > width - lw - space(w.bold)) { lines.push(line); line = []; lw = 0; continue; } const part = {...w, t: s.slice(0, n)}; if (line.length) lw += space(w.bold); line.push(part); lw += tw(part.t, w.bold, size); s = s.slice(n); if (s.length) { lines.push(line); line = []; lw = 0; } }
          return;
        }
        const add = (line.length ? space(w.bold) : 0) + ww;
        if (line.length && lw + add > width) { lines.push(line); line = []; lw = 0; ww = tw(w.t, w.bold, size); lw = ww; line.push(w); return; }
        lw += add; line.push(w);
      });
      if (line.length) lines.push(line);
      return lines;
    };
    d.drawLines = (lines, x, y, size, lead, defColor) => {
      lines.forEach((ln, i) => {
        let cx = x; const yy = y - i * lead;
        ln.forEach((w, j) => { const s = (j ? ' ' : '') + w.t; d.text(cx, yy, s, {size, bold: w.bold, color: w.color || defColor}); cx += tw(s, w.bold, size); });
      });
      return lines.length * lead;
    };
    d.need = (h) => { if (d.y - h < d.MB) { d.page(); return true; } return false; };
    d.bytes = (meta) => {
      const objs = []; const add = (s) => { objs.push(s); return objs.length; };
      const cat = add(null), pagesId = add(null);
      const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      let im = 0;
      const ximg = (m) => add(`<< /Type /XObject /Subtype /Image /Width ${m.w} /Height ${m.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${m.data.length} >>\nstream\n${m.data}\nendstream`);
      if (d.img) im = ximg(d.img);
      const xs = d.extra.map((m) => [m.name, ximg(m)]);
      const xobj = [im ? `/Im1 ${im} 0 R` : '', ...xs.map(([n, id]) => `/${n} ${id} 0 R`)].filter(Boolean).join(' ');
      const kids = [];
      d.pages.forEach((p) => {
        const content = p.ops.join('\n');
        const cid = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
        const annots = p.links.map((l) => add(`<< /Type /Annot /Subtype /Link /Rect [${l.r}] /Border [0 0 0] /A << /S /URI /URI (${esc(enc(l.url))}) >> >>`));
        const res = `<< /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >>${xobj ? ` /XObject << ${xobj} >>` : ''} >>`;
        kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources ${res} /Contents ${cid} 0 R${annots.length ? ` /Annots [${annots.map((a) => a + ' 0 R').join(' ')}]` : ''} >>`));
      });
      objs[cat - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
      objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
      const info = add(`<< /Title (${esc(enc(meta.title))}) /Author (${esc(enc(meta.author))}) /Producer (Magnolia Admin) >>`);
      let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'; const offs = [];
      objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
      const xref = out.length;
      out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
      out += `trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
      const b = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) b[i] = out.charCodeAt(i) & 255; return b;
    };
    return d;
  }

  const listNames = (a) => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  const shortUrl = (u) => { const s = String(u || '').replace(/^https?:\/\/(www\.)?/, ''); return s.length > 80 ? s.slice(0, 77) + '...' : s; };
  const fmtDue = (d) => { const t = new Date(d + 'T12:00:00Z'); return t.toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'}); };
  const fmtShort = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});

  // pull phone numbers and email addresses out of free text, for paper (links can't be clicked)
  const PH = /\(?\b\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b(?:\s*(?:ext\.?|x)\s*\d+)?/gi, EM = /[\w.+-]+@[\w-]+\.[\w.]+[a-z]/gi;
  const contacts = (...texts) => {
    const s = texts.filter(Boolean).join(' '), out = [];
    (s.match(PH) || []).map((p) => (p.startsWith('(') && !p.includes(')') ? p.slice(1) : p)).forEach((p) => { if (!out.includes(p)) out.push(p); });
    (s.match(EM) || []).forEach((e) => { if (!out.includes(e)) out.push(e); });
    return out.slice(0, 4);
  };
  const domain = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/, '').split(/[/?#]/)[0];

  // model: {counties, withNbrs, title?, today, summary, bids, orgs, signals, past, buyers, logo}
  function build(m) {
    const d = Doc(); const {ML, CW} = d; const X2 = ML + CW;
    const base = m.counties.length === 1 ? m.counties[0] + ' County' : listNames(m.counties) + ' Counties';
    const title = m.title || (m.withNbrs ? base + ' and surrounding counties' : base);
    d.MB = 40;
    d.img = m.logo || null;
    d.onPage = (n) => { if (n > 1) d.y = d.PH - 64; }; // running header is added at the end, once page count is known
    d.page();
    // ---- cover ----
    const top = d.y;
    if (d.img) { const w = Math.min(190, 40 * d.img.w / d.img.h); d.image(ML, top - w * d.img.h / d.img.w + 6, w, w * d.img.h / d.img.w); }
    else d.text(ML, top - 14, 'Magnolia Roofing & Remodeling', {size: 14, bold: true, color: 'mag'});
    const dt = 'Prepared ' + fmtShort(m.today); d.text(X2 - tw(dt, false, 8), top - 8, dt, {size: 8, color: 'slate'});
    d.y = top - 66;
    d.y -= d.drawLines(d.wrap([{t: title, bold: true}], 18, CW), ML, d.y, 18, 21, 'ink');
    d.y -= 1;
    d.y -= d.drawLines(d.wrap([{t: 'Roofing leads for a visit: open bids, who to see, roof work coming, and what these buyers have bid recently. Confirm dates and requirements with the buyer before bidding.'}], 8.5, CW), ML, d.y, 8.5, 11.5, 'slate');
    d.y -= 12;
    // ---- county summary panel (splits across pages when there are many counties) ----
    const rows = m.summary, compact = rows.length > 6, rh = compact ? 22 : 34, PADX = 18, PADY = 6;
    const cells = (r) => [[r.open, 'open bids'], [r.orgs, 'organizations'], [r.signals, 'work coming'], [r.past, 'bids, last 12 mo']];
    let i0 = 0;
    while (i0 < rows.length) {
      const avail = d.y - d.MB - 10;
      if (avail < 2 * PADY + rh) { d.page(); continue; }
      const n = Math.min(rows.length - i0, Math.floor((avail - 2 * PADY) / rh));
      const ph = 2 * PADY + n * rh, ptop = d.y;
      d.rrect(ML, ptop - ph, CW, ph, 8, 'mist');
      rows.slice(i0, i0 + n).forEach((r, i) => {
        const rt = ptop - PADY - i * rh; // top of this row
        if (i) d.hline(ML + PADX, X2 - PADX, rt, 'line', 0.6);
        let cx = ML + 180;
        if (compact) {
          const yb = rt - 14.5;
          d.text(ML + PADX, yb, r.county, {size: 9.5, bold: true, color: 'ink'});
          d.text(ML + PADX + 4 + tw(r.county, true, 9.5), yb, r.region, {size: 7, color: 'slate'});
          cells(r).forEach(([nn, l]) => { const s1 = String(nn); d.text(cx, yb, s1, {size: 9.5, bold: true, color: nn && l === 'open bids' ? 'leaf' : 'mag'}); d.text(cx + tw(s1, true, 9.5) + 3, yb, l, {size: 7, color: 'slate'}); cx += 80; });
        } else {
          d.text(ML + PADX, rt - 15, r.county + ' County', {size: 10, bold: true, color: 'ink'});
          d.text(ML + PADX, rt - 26, r.region, {size: 7.5, color: 'slate'});
          cells(r).forEach(([nn, l]) => { d.text(cx, rt - 15, String(nn), {size: 11, bold: true, color: nn && l === 'open bids' ? 'leaf' : 'mag'}); d.text(cx, rt - 26, l, {size: 7, color: 'slate'}); cx += 80; });
        }
      });
      d.y -= ph + 10; i0 += n;
    }
    d.y -= 24; // breathing room before the first section

    // ---- map on the cover: leads (circles show their score) over hail heat, wind and tornado reports ----
    if (m.map) {
      const M = m.map, legendH = 58 + (M.stats ? M.stats.length * 12 : 0);
      let avail = d.y - d.MB - legendH - 26;
      if (avail < 260) { d.page(); avail = d.y - d.MB - legendH - 26; }
      const mw = Math.min(CW, avail * M.w / M.h), mh = mw * M.h / M.w, mx = ML + (CW - mw) / 2;
      d.y += 10;
      d.extra.push({name: 'Map1', w: M.w, h: M.h, data: M.data});
      d.image(mx, d.y - mh, mw, mh, 'Map1');
      d.y -= mh + 11;
      const N = M.counts || {};
      const legend = (items, y) => { let lx = ML; items.forEach(([col, label, ring]) => { if (col) { if (ring === 'tri') d.tri(lx + 4, y + 3, 4.4, col); else { d.circle(lx + 4, y + 3, 3.8, col); if (ring) d.circle(lx + 4, y + 3, 2.3, 'white'); } lx += 11; } d.text(lx, y, label, {size: 7.5, color: col ? 'body' : 'ink', bold: !col}); lx += tw(label, !col, 7.5) + 10; }); };
      legend([[null, (N.leads || 0) + ' leads (same filters as the Focus list)'], ['leaf', 'Bids'], ['mag', 'Organizations'], ['sig', 'Early warnings'], ['gc', 'Builders & GCs']], d.y);
      d.y -= 11;
      d.y -= d.drawLines(d.wrap([{t: 'Each dot sits at the lead\'s address; the number beside it is its score. Filled dot: dollar size known, bigger means more $ (' + (N.money || 0) + '). Ring: size unknown, bigger means a better score.' + (N.approx ? ' ' + N.approx + ' leads with no street address on file aren\'t shown on the map.' : '')}], 7.5, CW), ML, d.y, 7.5, 10, 'slate');
      d.y -= 2;
      legend([['orange', 'Hail 1"+, ' + M.range + ' (heat = more/bigger hail)'], ['blue', 'Damaging wind'], ['green', 'Tornado', 'tri']], d.y);
      d.y -= 13;
      (M.stats || []).forEach((t) => { d.y -= d.drawLines(d.wrap([{t: t.label + ': ', bold: true}, {t: t.text}], 8, CW), ML, d.y, 8, 11, 'body'); });
      d.y -= 8;
      // closer look at where most of the leads are, top of page 2
      if (m.map2) {
        d.page();
        const M2 = m.map2, mh2 = Math.min(CW * M2.h / M2.w, d.y - d.MB - 40), mw2 = mh2 * M2.w / M2.h;
        d.text(ML, d.y, 'Closer look' + (m.map2.title ? ': ' + m.map2.title : ''), {size: 12.5, bold: true, color: 'mag'});
        d.y -= 5; d.hline(ML, X2, d.y, 'mag', 0.9); d.y -= 6;
        d.extra.push({name: 'Map2', w: M2.w, h: M2.h, data: M2.data});
        d.image(ML + (CW - mw2) / 2, d.y - mh2, mw2, mh2, 'Map2');
        d.y -= mh2 + 10;
        d.y -= d.drawLines(d.wrap([{t: 'Same dots and scores as the cover map, zoomed in to where most leads are. Storms: same ' + M.range + ' of hail, wind and tornado reports.'}], 7.5, CW), ML, d.y, 7.5, 10, 'slate');
        d.page();
      }
    }

    let firstSection = true;
    const section = (name, sub) => {
      if (!firstSection) d.y -= 16; // clear air between sections
      firstSection = false;
      d.need(70);
      d.text(ML, d.y, name, {size: 12.5, bold: true, color: 'mag'});
      d.y -= 5; d.hline(ML, X2, d.y, 'mag', 0.9); d.y -= 11;
      if (sub) { d.y -= d.drawLines(d.wrap([{t: sub}], 7.5, CW), ML, d.y, 7.5, 9.5, 'slate'); d.y -= 7; }
    };
    // One item, laid out like a Focus list card on the page: score circle on the left, then the title
    // (with an optional pill on the right), meta line, body, contact line and reason chips. White space only between items.
    const R = 11; // score circle radius
    const item = (o) => {
      const hasS = o.score != null, x0 = hasS ? ML + 2 * R + 9 : ML, w0 = X2 - x0;
      const pw = o.pill ? tw(enc(o.pill.t), true, 7) + 12 : 0;
      const laid = o.parts.map((p, i) => ({...p, lines: d.wrap(p.runs, p.size, w0 - (i === 0 && o.pill ? pw + 8 : 0))}));
      const rows = [];
      if (o.chips && o.chips.length) {
        let row = [], rw = 0;
        o.chips.forEach((c) => { const cw = tw(enc(c.t), false, 6.5) + 10; if (row.length && rw + cw > w0) { rows.push(row); row = []; rw = 0; } row.push({...c, w: cw}); rw += cw + 3; });
        if (row.length) rows.push(row);
      }
      const textH = laid.reduce((s, p) => s + p.lines.length * p.lead + (p.gap || 0), 0) + (rows.length ? 2 + rows.length * 12.5 : 0);
      d.need(Math.max(hasS ? 2 * R + 4 : 0, textH) + 2);
      const y0 = d.y;
      if (hasS) {
        const [bg, fg] = TIER[o.tier] || TIER[1], cx = ML + R, cy = y0 + 7 - R, s = String(o.rank || o.score), fs = s.length > 3 ? 7.6 : 9.5;
        d.circle(cx, cy, R, bg); d.text(cx - tw(s, true, fs) / 2, cy - fs * .36, s, {size: fs, bold: true, color: fg});
      }
      laid.forEach((p) => { d.y -= d.drawLines(p.lines, x0, d.y, p.size, p.lead, p.color) + (p.gap || 0); });
      if (rows.length) {
        d.y -= 2;
        rows.forEach((row) => { let x = x0; row.forEach((c) => { d.rrect(x, d.y - 3, c.w, 10.5, 5.25, c.neg ? 'conbg' : 'mist'); d.text(x + 5, d.y - 0.2, c.t, {size: 6.5, color: c.neg ? 'contx' : 'body'}); x += c.w + 3; }); d.y -= 12.5; });
      }
      if (o.pill) { d.rrect(X2 - pw, y0 - 3, pw, 12, 6, o.pill.bg); d.text(X2 - pw + 6, y0, o.pill.t, {size: 7, bold: true, color: o.pill.fg}); }
      d.y = Math.min(d.y, y0 - (hasS ? 2 * R + 1 : 0)) - (o.gap == null ? 10 : o.gap);
    };
    const P = (runs, size, lead, color, extra) => Object.assign({runs: Array.isArray(runs) ? runs : [{t: runs}], size, lead, color}, extra || {});
    const chips = (x) => [...(x.pros || []).map((t) => ({t})), ...(x.cons || []).map((t) => ({t, neg: true}))];
    const meta = (a) => a.filter(Boolean).join(' · ');
    const TT = (t) => P([{t, bold: true}], 9.5, 11.5, 'ink', {gap: 1});
    const MT = (a) => P(meta(a), 7.5, 9.5, 'slate', {gap: 1.5});
    const BD = (t, label) => P(label ? [{t: label + ' ', bold: true}, {t}] : t, 8, 10, 'body', {gap: 1});
    // contact line: phones and emails found in the text, else the website's name
    const CT = (list, url) => list.length ? [BD(list.join('   '), 'Contact:')] : url && /^https?:/.test(url) ? [BD(domain(url), 'Web:')] : [];
    // who to call or visit: the named contact, phone, email and street address when we have them;
    // otherwise any phone or email found in the text, else the website's name
    const WHO = (c, texts, url) => {
      const who = [c.name ? c.name + (c.title ? ', ' + c.title : '') : '', c.phone, c.email].filter(Boolean);
      const out = who.length ? [BD(who.join('   '), 'Contact:')] : CT(contacts(...texts), url);
      if (c.address) out.push(BD(c.address, 'Address:'));
      return out;
    };

    // ---- open bids ----
    section('Open bids', m.bids.length ? 'Still accepting bids, soonest deadline first.' : 'No open roof bids in these counties right now. Check the buyers below for what\'s coming.');
    m.bids.forEach((b) => {
      const n = b.days;
      const pill = b.due ? {t: n <= 0 ? 'Due today' : n === 1 ? '1 day left' : n + ' days left', bg: n <= 7 ? 'red' : 'tint', fg: n <= 7 ? 'white' : 'mag'} : {t: 'Apply any time', bg: 'leaftint', fg: 'leaf'};
      const parts = [TT(b.title), MT([b.county ? b.county + ' County' : '', b.agency !== b.county + ' County' ? b.agency : '', b.due ? 'Due ' + fmtDue(b.due) : 'Open until filled', b.sol_no ? 'No. ' + b.sol_no : '', b.est_value])];
      if (b.description) parts.push(BD(b.description));
      if (b.requirements) parts.push(BD(b.requirements, 'Needs:'));
      item({score: b.score, rank: b.rank, tier: b.tier, pill, parts: [...parts, ...WHO({name: b.contact_name, phone: b.contact_phone, email: b.contact_email, address: b.address}, [b.requirements, b.description], b.link)], chips: chips(b)});
    });
    // ---- who to see ----
    section('Who to see', 'Organizations that own or manage roofs here, ranked by how winnable they look for Magnolia.');
    if (!m.orgs.length) d.y -= d.drawLines(d.wrap([{t: 'No organizations on file for these counties yet.'}], 8, CW), ML, d.y, 8, 10, 'slate') + 6;
    m.orgs.forEach((o) => {
      const parts = [TT(o.org), MT([o.county ? o.county + ' County' : o.region, o.group])];
      if (o.why) parts.push(BD(o.why));
      if (o.recent_signal) parts.push(BD(o.recent_signal));
      if (o.how_to_get_in) parts.push(BD(o.how_to_get_in, 'Next step:'));
      item({score: o.score, rank: o.rank, tier: o.tier, parts: [...parts, ...WHO({name: o.contact_name, title: o.contact_title, phone: o.phone, email: o.email, address: o.address}, [o.how_to_get_in, o.why, o.recent_signal], o.url)], chips: chips(o)});
    });
    // ---- work coming ----
    if (m.signals.length) {
      section('Roof work coming', 'Budget requests, bonds, consultant hires and plans that usually turn into bids months later.');
      m.signals.forEach((s) => {
        const parts = [TT(s.title), MT([s.county ? s.county + ' County' : '', s.org !== s.county + ' County' ? s.org : '', s.planned_year ? 'Planned ' + s.planned_year : '', s.est_value])];
        if (s.notes) parts.push(BD(s.notes));
        item({score: s.score, rank: s.rank, tier: s.tier, pill: s.signal_type ? {t: s.signal_type, bg: 'mist', fg: 'mag'} : null, parts: [...parts, ...CT(contacts(s.notes), s.url)], chips: chips(s)});
      });
    }
    // ---- recent bids ----
    if (m.past.length) {
      section('Recent roof bids', 'What these buyers bid in the last 12 months: good talking points, and who won.');
      m.past.forEach((r) => {
        item({parts: [P([{t: fmtShort(r.due) + '   ', bold: true, color: 'slate'}, {t: r.title, bold: true}], 8.5, 10.5, 'ink', {gap: 1}), P(meta([r.agency, r.award]), 7.5, 9.5, 'slate')], gap: 7});
      });
    }
    // ---- running header on pages 2+ (no footers) ----
    const N = d.pages.length;
    d.pages.forEach((p, i) => {
      if (!i) return;
      d.cur = p;
      d.text(ML, d.PH - 36, 'Magnolia Roofing & Remodeling · ' + title, {size: 7.5, color: 'slate'});
      const pg = 'Page ' + (i + 1) + ' of ' + N; d.text(X2 - tw(pg, false, 7.5), d.PH - 36, pg, {size: 7.5, color: 'slate'});
      d.hline(ML, X2, d.PH - 42, 'line', 0.5);
    });
    return d.bytes({title, author: 'Magnolia Roofing & Remodeling'});
  }
  W.MGPDF = {build, tw, enc, Doc, C};
})();

// ---- Field sheet: picking counties and building the model ----
(() => {
  const MG = window.MG;
  if (!MG) return;   // loaded on a page without the Overview (the bid page uses only the PDF writer)
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const today = () => new Date().toISOString().slice(0, 10);
  const days = (d) => Math.round((Date.parse(d + 'T12:00:00Z') - Date.parse(today() + 'T12:00:00Z')) / 864e5);

  // Pure: everything the PDF shows, from rows already filtered for hidden items.
  function model(D, selected, withNbrs, H) {
    const set = new Set(selected);
    if (withNbrs) selected.forEach((c) => ((D.cty[c] && D.cty[c].neighbors) || '').split(',').filter(Boolean).forEach((n) => set.add(n)));
    const inSet = (r) => set.has(r.county);
    const t0 = today(), yearAgo = new Date(Date.parse(t0) - 365 * 864e5).toISOString().slice(0, 10);
    const opps = D.opps.filter(inSet);
    // scored the same way as the Focus list on the page
    const leads = MG.rankLeads(H.buildLeads(D.opps, D.targets, D.signals).filter(inSet));
    const bids = leads.filter((x) => x.kind === 'bid' && H.isOpen(x)).map((r) => ({...r, days: r.due ? days(r.due) : null}))
      .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    const past = opps.filter((r) => r.due && r.due < t0 && r.due >= yearAgo).sort((a, b) => b.due.localeCompare(a.due));
    const orgs = leads.filter((x) => x.kind === 'org').map((x) => ({...x, priority: String(x.priority) === '1'}))
      .sort((a, b) => a.rankIdx - b.rankIdx);
    const signals = leads.filter((x) => x.kind === 'signal').sort((a, b) => a.rankIdx - b.rankIdx);
    const buyers = (D.buyers || []).filter((b) => inSet(b) && /^https?:/.test(b.bid_page_url || '')).sort((a, b) => a.county.localeCompare(b.county) || a.agency.localeCompare(b.agency));
    const order = [...selected, ...[...set].filter((c) => !selected.includes(c)).sort()];
    const summary = order.map((c) => ({county: c, region: (D.cty[c] && D.cty[c].region) || '',
      open: bids.filter((r) => r.county === c).length, orgs: orgs.filter((r) => r.county === c).length,
      priority: orgs.filter((r) => r.county === c && r.priority).length, signals: signals.filter((r) => r.county === c).length,
      past: past.filter((r) => r.county === c).length}));
    summary.forEach((s) => { if (!selected.includes(s.county)) s.region = (s.region ? s.region + ' · ' : '') + 'neighboring'; });
    return {counties: selected, withNbrs: !!withNbrs, today: t0, summary, bids, orgs, signals, past, buyers};
  }
  MG.fsModel = model;

  async function logoJpeg() {
    const img = document.querySelector('.mg .brand .logo');
    if (!img) return null;
    if (img.decode) await img.decode().catch(() => {});
    const w = img.naturalWidth, h = img.naturalHeight; if (!w || !h) return null;
    const s = Math.min(1, 900 / w), cw = Math.round(w * s), ch = Math.round(h * s);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, cw, ch); g.drawImage(img, 0, 0, cw, ch);
    return {w: cw, h: ch, data: atob(c.toDataURL('image/jpeg', 0.92).split(',')[1])};
  }

  // The PDF uses the Focus area: the counties picked (plus neighbors when that box is ticked), or every county in the picked region.
  const go = document.getElementById('fs-go');
  if (!go) return;
  go.addEventListener('click', async () => {
    let list = [...(MG.counties || [])], title = null;
    if (!list.length && MG.region) {
      list = Object.values(MG.CTY || {}).filter((c) => c.region === MG.region && (!MG.hideMetro || !MG.isMetro(c.county))).map((c) => c.county).sort();
      title = 'The ' + MG.region;
    }
    if (!list.length) { MG.toast('Pick a county or a region under Focus area first.'); const a = document.getElementById('area'); if (a) a.focus(); return; }
    const HM = MG.hiddenMap ? MG.hiddenMap() : new Map();
    const rows = (id) => { const d = dash.data(id); return d.status === 'ok' ? d.data.filter((r) => !HM.has(id + ':' + r.key)) : null; };
    const D = {opps: rows('opps'), targets: rows('targets'), signals: rows('signals') || [], cty: MG.CTY || {}};
    if (!D.opps || !D.targets) { MG.toast('Still loading the data. Try again in a moment.'); return; }
    go.disabled = true; const label = go.textContent; go.textContent = 'Building PDF…';
    try {
      const m = model(D, list, !!MG.nbrs && !title, {isOpen: MG.isOpen, buildLeads: MG.buildLeads});
      if (title) m.title = title;
      m.logo = await logoJpeg().catch(() => null);
      go.textContent = 'Drawing map…';
      const mapCounties = [...new Set([...list, ...m.summary.map((r) => r.county)])], mapLeads = [...m.bids, ...m.orgs, ...m.signals];
      try { m.map = MG.reportMap ? await MG.reportMap(mapCounties, mapLeads, 2) : null; } catch (e) { console.error('report map', e); m.map = null; }
      if (m.map && m.map.dense) { try { m.map2 = await MG.reportMap(mapCounties, mapLeads, 2, m.map.dense); if (m.map2) m.map2.title = m.map.denseName || ''; } catch (e) { m.map2 = null; } }
      go.textContent = 'Building PDF…';
      const bytes = window.MGPDF.build(m);
      const names = list.length === 1 ? list[0] + ' County' : list.length > 5 ? list.slice(0, 5).join(', ') + ' and ' + (list.length - 5) + ' more counties' : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] + ' Counties';
      const now = new Date(), stamp = [now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, '0')).join('-') + '-' + now.getFullYear();
      // e.g. magnolia-aiken-county-and-surrounding-counties-10-23-2026.pdf
      const slug = ('magnolia ' + (title ? 'the ' + MG.region : names + (m.withNbrs ? ' and surrounding counties' : ''))).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const name = slug + '-' + stamp + '.pdf';
      const dl = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('downloads') : null;
      if (dl) await dl.save({filename: name, data: new Blob([bytes], {type: 'application/pdf'})});
      else { const a = el('a'); a.href = URL.createObjectURL(new Blob([bytes], {type: 'application/pdf'})); a.download = name; document.body.append(a); a.click(); a.remove(); }
    } catch (e) {
      if (!(e && e.code === 'declined')) { console.error('field sheet', e); MG.toast('Couldn’t make the PDF' + (e && e.code === 'unavailable' ? ': downloads aren’t available here.' : '. Try again.')); }
    } finally { go.disabled = false; go.textContent = label; }
  });
})();
