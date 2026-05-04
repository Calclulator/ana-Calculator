// gfs-client.js — GFS proxy: 4 levels + gfsValueAt (ES5)
var GFS_PROXY = 'https://ana-calculator-gfs-proxy.vercel.app';

(function(global) {
  if (!global) global = window;

  var LEVELS_MB = [300, 250, 200, 150];
  var VARS_DEFAULT = 'UGRD,VGRD,TMP,HGT';

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function pickGfsCycle(refUtc) {
    var t = refUtc.getTime() - 8 * 3600000;
    var u = new Date(t);
    var y = u.getUTCFullYear();
    var mo = u.getUTCMonth() + 1;
    var da = u.getUTCDate();
    var h = u.getUTCHours();
    var ch = Math.floor(h / 6) * 6;
    return '' + y + pad2(mo) + pad2(da) + pad2(ch);
  }

  function wpLon(w) {
    if (typeof w.lon === 'number' && !isNaN(w.lon)) return w.lon;
    if (typeof w.lng === 'number' && !isNaN(w.lng)) return w.lng;
    return NaN;
  }

  function bboxFromWaypoints(wps, pad) {
    pad = typeof pad === 'number' ? pad : 1.5;
    var i, w, la, lo, s, n, e, wst, any = false;
    s = 90;
    n = -90;
    e = -180;
    wst = 180;
    for (i = 0; i < wps.length; i++) {
      w = wps[i];
      la = w.lat;
      lo = wpLon(w);
      if (typeof la !== 'number' || isNaN(la) || typeof lo !== 'number' || isNaN(lo)) continue;
      any = true;
      if (la < s) s = la;
      if (la > n) n = la;
      if (lo < wst) wst = lo;
      if (lo > e) e = lo;
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

  function maxCtmeMin(wps) {
    var last = 0;
    var i, c;
    for (i = 0; i < wps.length; i++) {
      c = wps[i].ctme;
      if (typeof c === 'number' && !isNaN(c) && c > last) last = c;
    }
    return last;
  }

  function estimateFhrFromCtme(maxMin) {
    var hrs = Math.round(maxMin / 60);
    if (hrs < 0) hrs = 0;
    if (hrs > 120) hrs = 120;
    return hrs;
  }

  function uniqFhList(primary) {
    var cand = [Math.max(0, primary - 3), primary, Math.min(384, primary + 3)];
    var seen = {};
    var out = [];
    var j, u;
    for (j = 0; j < cand.length; j++) {
      u = cand[j];
      if (seen[u]) continue;
      seen[u] = 1;
      out.push(u);
    }
    return out;
  }

  function gfsUrl(cycle, fhr, lev, box) {
    var base = GFS_PROXY.replace(/\/$/, '');
    return base + '/api/gfs?cycle=' + cycle +
      '&fhr=' + fhr +
      '&lev=' + lev +
      '&west=' + box.west +
      '&east=' + box.east +
      '&south=' + box.south +
      '&north=' + box.north +
      '&vars=' + encodeURIComponent(VARS_DEFAULT);
  }

  function refTimeToMs(rt) {
    if (!rt || typeof rt.year !== 'number') return NaN;
    return Date.UTC(rt.year, rt.month - 1, rt.day, rt.hour, rt.minute, rt.second || 0);
  }

  function pickSliceForValid(G, levMb, validUtc) {
    if (!G || !G.slices || !G.slices.length) return null;
    var target = validUtc.getTime();
    var best = null;
    var bestScore = 1e18;
    var i, s, dlev, rtms, wantFhr, df;
    for (i = 0; i < G.slices.length; i++) {
      s = G.slices[i];
      if (!s || !s.meta) continue;
      dlev = Math.abs((s.meta.lev || 0) - levMb);
      if (dlev > 1) continue;
      rtms = refTimeToMs(s.meta.refTime);
      if (isNaN(rtms)) continue;
      wantFhr = (target - rtms) / 3600000;
      df = Math.abs((s.meta.fhr || 0) - wantFhr);
      if (df < bestScore) {
        bestScore = df;
        best = s;
      }
    }
    return best;
  }

  function gfsSampleSlice(slice, lat, lon, varName) {
    var g = slice.grid;
    var arr = slice.vars && slice.vars[varName];
    if (!g || !arr || !arr.length) return null;
    var nx = g.nx;
    var ny = g.ny;
    if (!nx || !ny || nx * ny !== arr.length) return null;
    var la1 = g.la1;
    var lo1 = g.lo1;
    var la2 = g.la2;
    var lo2 = g.lo2;
    var dlat = ny > 1 ? (la1 - la2) / (ny - 1) : (la1 - la2 || 1e-6);
    var dlon = nx > 1 ? (lo2 - lo1) / (nx - 1) : (lo2 - lo1 || 1e-6);
    var iy = (la1 - lat) / dlat;
    var ix = (lon - lo1) / dlon;
    if (ix < 0 || ix > nx - 1 || iy < 0 || iy > ny - 1) return null;
    var i0 = Math.floor(ix);
    var j0 = Math.floor(iy);
    var fx = ix - i0;
    var fy = iy - j0;
    var i1 = Math.min(i0 + 1, nx - 1);
    var j1 = Math.min(j0 + 1, ny - 1);
    function at(ixx, iyy) {
      var v = arr[iyy * nx + ixx];
      return (v === null || v === undefined || isNaN(v)) ? NaN : v;
    }
    var v00 = at(i0, j0);
    var v10 = at(i1, j0);
    var v01 = at(i0, j1);
    var v11 = at(i1, j1);
    if (isNaN(v00) || isNaN(v10) || isNaN(v01) || isNaN(v11)) return null;
    var a = v00 * (1 - fx) + v10 * fx;
    var b = v01 * (1 - fx) + v11 * fx;
    return a * (1 - fy) + b * fy;
  }

  function gfsValueAt(lat, lon, levMb, varName, validUtc) {
    var G = global.GFS;
    if (!G || !validUtc || !(validUtc instanceof Date)) return null;
    var key = (varName || 'TMP').toUpperCase();
    var sl = pickSliceForValid(G, levMb, validUtc);
    if (!sl) return null;
    return gfsSampleSlice(sl, lat, lon, key);
  }

  function gfsLoad(waypoints, ato) {
    if (!waypoints || waypoints.length < 2) return;
    if (!ato || !(ato instanceof Date) || isNaN(ato.getTime())) return;
    var box = bboxFromWaypoints(waypoints);
    if (!box) return;

    var cycle = pickGfsCycle(ato);
    var fhPrimary = estimateFhrFromCtme(maxCtmeMin(waypoints));
    var fhrs = uniqFhList(fhPrimary);
    var t0 = Date.now();

    global.GFS = {
      status: 'loading',
      cycle: cycle,
      ato: ato,
      bbox: box,
      levelsMb: LEVELS_MB.slice(),
      fhrs: fhrs.slice(),
      slices: [],
      startedMs: t0
    };

    var urls = [];
    var tasks = [];
    var fi, li, fhr, lev;
    for (fi = 0; fi < fhrs.length; fi++) {
      fhr = fhrs[fi];
      for (li = 0; li < LEVELS_MB.length; li++) {
        lev = LEVELS_MB[li];
        urls.push(gfsUrl(cycle, fhr, lev, box));
      }
    }

    for (fi = 0; fi < urls.length; fi++) {
      tasks.push(
        fetch(urls[fi], { method: 'GET', cache: 'default' }).then(function(r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        }).then(function(json) {
          if (!json || !json.grid || !json.vars) return null;
          return { meta: json.meta, grid: json.grid, vars: json.vars };
        })
      );
    }

    Promise.all(tasks).then(function(parts) {
      var out = [];
      var k;
      for (k = 0; k < parts.length; k++) {
        if (parts[k]) out.push(parts[k]);
      }
      global.GFS.slices = out;
      global.GFS.status = 'ready';
      global.GFS.elapsedMs = Date.now() - t0;
      global.GFS.urls = urls;
      console.log('[GFS] ready ' + out.length + '/' + urls.length + ' slices, ' + global.GFS.elapsedMs + 'ms cycle=' + cycle);
      if (typeof applyGfsRadarForCurrentMethod === 'function') {
        try { applyGfsRadarForCurrentMethod(); } catch (e2) {}
      }
    }).catch(function(err) {
      global.GFS.status = 'error';
      global.GFS.error = String(err && err.message ? err.message : err);
      console.error('[GFS] load failed:', err);
    });
  }

  global.gfsLoad = gfsLoad;
  global.gfsValueAt = gfsValueAt;
})(typeof window !== 'undefined' ? window : this);
