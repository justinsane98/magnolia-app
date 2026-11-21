/* Sign-in gate + read-only data shim for the static snapshot (built by build_app.py) */
(function () {
  'use strict';
  var KEY_NAME = 'mg-app-key', SALT = "magnolia-app-v1", BUILT = "Nov 21, 7:18 am";
  var K = null; try { K = localStorage.getItem(KEY_NAME); } catch (e) {}
  if (!K || !/(^|; )mg-app=1/.test(document.cookie)) {
    document.documentElement.style.display = 'none';
    location.replace('/login/?next=' + encodeURIComponent(location.pathname + location.search + location.hash));
    K = null;
  }
  var realFetch = window.fetch.bind(window);
  var hex = function (h) { var a = new Uint8Array(h.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; };
  var keyP = K ? crypto.subtle.importKey('raw', hex(K), 'AES-CBC', false, ['decrypt']) : null;
  var cache = new Map();
  var reply = function (body, status) { return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json' } }); };
  function load(path) {
    if (!cache.has(path)) {
      cache.set(path, (async function () {
        if (!keyP) return null;
        var d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SALT + path));
        var name = Array.from(new Uint8Array(d)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('').slice(0, 24);
        var r = await realFetch('/_app/d/' + name + '.bin', { cache: 'no-cache' });
        if (!r.ok) return null;
        var buf = new Uint8Array(await r.arrayBuffer());
        var plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: buf.slice(0, 16) }, await keyP, buf.slice(16));
        return new TextDecoder().decode(plain);
      })().catch(function () { return null; }));
    }
    return cache.get(path).then(function (t) { return t == null ? reply({ error: 'not in this snapshot' }, 404) : reply(t); });
  }
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || String(input);
    var u; try { u = new URL(url, location.href); } catch (e) { return realFetch(input, init); }
    if (u.origin !== location.origin || u.pathname.indexOf('/api/') !== 0) return realFetch(input, init);
    var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    if (method !== 'GET') return Promise.resolve(reply({ error: 'Read-only snapshot: make changes on the office board (localhost:6969).' }, 405));
    if (u.pathname === '/api/route') {
      var kind = u.searchParams.get('kind'), pts = u.searchParams.get('pts') || '';
      var osrm = kind === 'table' ? 'https://router.project-osrm.org/table/v1/driving/' + pts + '?annotations=duration,distance'
        : 'https://router.project-osrm.org/route/v1/driving/' + pts + '?overview=full&geometries=geojson&steps=true';
      return realFetch(osrm);
    }
    return load(decodeURIComponent(u.pathname.replace(/\/+$/, '')));
  };
  window.MG_SNAPSHOT = { built: BUILT, signOut: function () {
    try { localStorage.removeItem(KEY_NAME); } catch (e) {}
    document.cookie = 'mg-app=; Max-Age=0; Path=/; Secure; SameSite=Lax';
    location.href = '/login/';
  } };
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.createElement('div');
    b.id = 'mg-snap';
    b.innerHTML = 'Read-only snapshot · ' + BUILT + ' · <a href="#" id="mg-out">Sign out</a>';
    b.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;font:12px/1.3 -apple-system,Helvetica,Arial,sans-serif;background:rgba(255,255,255,.94);color:#555;border:1px solid #ddd;border-radius:6px;padding:4px 8px;box-shadow:0 1px 3px rgba(0,0,0,.12)';
    document.body.appendChild(b);
    document.getElementById('mg-out').addEventListener('click', function (e) { e.preventDefault(); window.MG_SNAPSHOT.signOut(); });
  });
})();
