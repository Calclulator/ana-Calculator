// gfs-client.js — browser client for ana-Calculator-gfs-proxy (/api/gfs)
// ES5 (var / function / concat) for iPad Safari compatibility.

(function(global) {
  if (!global) global = window;

  if (!global.GFS_PROXY_BASE) {
    global.GFS_PROXY_BASE = 'https://ana-calculator-gfs-proxy.vercel.app';
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  /** Latest nominal GFS cycle (00/06/12/18 UTC) with ~8h publication cushion */
  function pickGfsCycle() {
    var t = Date.now() - 8 * 3600000;
    var u = new Date(t);
    var y = u.getUTCFullYear();
    var mo = u.getUTCMonth() + 1;
    var da = u.getUTCDate();
    var h = u.getUTCHours();
    var ch = Math.floor(h / 6) * 6;
    return '' + y + pad2(mo) + pad2(da) + pad2(ch);
  }

  function bboxFromWaypoints(wps, pad) {
    pad = typeof pad === 'number' ? pad : 1.5;
    var i, w, s, n, e, wst;
    s = 90;
    n = -90;
    e = -180;
    wst = 180;
    var any = false;
    for (i = 0; i < wps.length; i++) {
      w = wps[i];
      if (typeof w.lat !== 'number' || typeof w.lng !== 'number') continue;
      any = true;
      if (w.lat < s) s = w.lat;
      if (w.lat > n) n = w.lat;
      if (w.lng < wst) wst = w.lng;
      if (w.lng > e) e = w.lng;
    }
    if (!any || s > n) return null;
    s = Math.max(-85, s - pad);
    n = Math.min(85, n + pad);
    wst = wst - pad;
    e = e + pad;
    if (wst < -180) wst = -180;
    if (e > 360) e = 360;
    if (wst >= e) return null;
    return { south: s, north: n, west: wst, east: e };
  }

  /** Rough forecast hour from last WP cumulative time (minutes → hours). */
  function estimateFhr(wps) {
    var last = 0;
    var i, c;
    for (i = 0; i < wps.length; i++) {
      c = wps[i].ctme;
      if (typeof c === 'number' && !isNaN(c) && c > last) last = c;
    }
    var hrs = Math.round(last / 60);
    if (hrs < 0) hrs = 0;
    if (hrs > 120) hrs = 120;
    return hrs;
  }

  function gfsUrl(params) {
    var base = (global.GFS_PROXY_BASE || '').replace(/\/$/, '');
    var q = 'cycle=' + params.cycle +
      '&fhr=' + params.fhr +
      '&lev=' + params.lev +
      '&west=' + params.west +
      '&east=' + params.east +
      '&south=' + params.south +
      '&north=' + params.north +
      '&vars=' + encodeURIComponent(params.vars || 'UGRD,VGRD');
    return base + '/api/gfs?' + q;
  }

  /**
   * @param {Array} waypoints  global WP 相当 { lat, lng, ctme, ... }
   * @param {*} depRefMin     DEP_ATO_MIN があれば優先、なければ DEP_STD_MIN（分）
   */
  function gfsLoad(waypoints, depRefMin) {
    if (!waypoints || waypoints.length < 2) return;
    var box = bboxFromWaypoints(waypoints);
    if (!box) return;

    var cycle = pickGfsCycle();
    var fhPrimary = estimateFhr(waypoints);
    var cand = [
      Math.max(0, fhPrimary - 3),
      fhPrimary,
      Math.min(384, fhPrimary + 3)
    ];
    var seen = {};
    var uniq = [];
    var j, u;
    for (j = 0; j < cand.length; j++) {
      u = cand[j];
      if (seen[u]) continue;
      seen[u] = 1;
      uniq.push(u);
    }

    var lev = 300;
    var t0 = Date.now();
    global.GFS_LOAD_STARTED = {
      cycle: cycle, fhrs: uniq, lev: lev, bbox: box, t0: t0, depRefMin: depRefMin
    };

    var urls = [];
    for (j = 0; j < uniq.length; j++) {
      urls.push(gfsUrl({
        cycle: cycle,
        fhr: uniq[j],
        lev: lev,
        west: box.west,
        east: box.east,
        south: box.south,
        north: box.north,
        vars: 'UGRD,VGRD,TMP,HGT'
      }));
    }

    Promise.all(urls.map(function(url) {
      return fetch(url, { method: 'GET', cache: 'default' }).then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
        return r.json();
      });
    })).then(function(slices) {
      global.GFS_LAST_BUNDLE = {
        cycle: cycle,
        lev: lev,
        bbox: box,
        slices: slices,
        elapsedMs: Date.now() - t0
      };
      console.log('[GFS] ' + slices.length + ' slice(s) in ' + global.GFS_LAST_BUNDLE.elapsedMs + 'ms', cycle);
    }).catch(function(err) {
      console.error('[GFS] parallel load failed:', err);
    });
  }

  global.gfsLoad = gfsLoad;
})(typeof window !== 'undefined' ? window : this);
