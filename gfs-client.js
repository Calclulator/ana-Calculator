// gfs-client.js — GFS proxy: 7 levels + gfsValueAt (ES5)
var GFS_PROXY = 'https://ana-calculator-gfs-proxy.vercel.app';

(function(global) {
  if (!global) global = window;

  var LEVELS_MB = [300, 275, 250, 225, 200, 175, 150];
  var VARS_DEFAULT = 'UGRD,VGRD,TMP,HGT';

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function pickGfsCycle(refUtc) {
    // GFS cycles become available on NOMADS ~4-5h after cycle hour.
    // Always pick based on CURRENT time (not ATO which may be in the future)
    // to avoid requesting cycles that do not exist yet.
    var now = new Date();
    var t = now.getTime() - 5 * 3600000;
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

  // 経度配列を連続化 (Leaflet unwrap と同じ・隣接との差が +-180 を超えない)
  function unwrapLngSequence(lons) {
    var out = [];
    if (!lons || !lons.length) return out;
    var i, prev, lngU, d;
    prev = lons[0];
    out.push(prev);
    for (i = 1; i < lons.length; i++) {
      lngU = lons[i];
      d = lngU - prev;
      while (d > 180) {
        lngU -= 360;
        d = lngU - prev;
      }
      while (d < -180) {
        lngU += 360;
        d = lngU - prev;
      }
      out.push(lngU);
      prev = lngU;
    }
    return out;
  }

  function bboxFromWaypoints(wps, pad) {
    pad = typeof pad === 'number' ? pad : 3.3;
    var pts = [];
    var i, w, la, lo, j, lonU, wst, e;
    for (i = 0; i < wps.length; i++) {
      w = wps[i];
      la = w.lat;
      lo = wpLon(w);
      if (typeof la !== 'number' || isNaN(la) || typeof lo !== 'number' || isNaN(lo)) continue;
      pts.push({ lat: la, lon: lo });
    }
    if (!pts.length) return null;
    var lons = [];
    for (j = 0; j < pts.length; j++) {
      lons.push(pts[j].lon);
    }
    lonU = unwrapLngSequence(lons);
    var s = 90;
    var n = -90;
    for (j = 0; j < pts.length; j++) {
      if (pts[j].lat < s) s = pts[j].lat;
      if (pts[j].lat > n) n = pts[j].lat;
    }
    wst = lonU[0];
    e = lonU[0];
    for (j = 1; j < lonU.length; j++) {
      if (lonU[j] < wst) wst = lonU[j];
      if (lonU[j] > e) e = lonU[j];
    }
    if (s > n) return null;
    s = Math.max(-85, s - pad);
    n = Math.min(85, n + pad);
    wst = wst - pad;
    e = e + pad;
    if (wst < -360) wst = -360;
    if (e > 720) e = 720;
    if (wst >= e) return null;
    return { south: s, north: n, west: wst, east: e };
  }

  // グリッドの経度範囲 [min(lo1,lo2), max(lo1,lo2)] に入るよう lon を k*360 でシフト (look-up 共有用)
  function normalizeLongitudeForGridExtent(lon, lo1, lo2) {
    var gLo = Math.min(lo1, lo2);
    var gHi = Math.max(lo1, lo2);
    var best = lon;
    var bestPen = 1e18;
    var k, t, pen;
    for (k = -3; k <= 3; k++) {
      t = lon + k * 360;
      if (t < gLo) {
        pen = gLo - t;
      } else if (t > gHi) {
        pen = t - gHi;
      } else {
        pen = 0;
      }
      if (pen < bestPen) {
        bestPen = pen;
        best = t;
      }
    }
    return best;
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

  function calcFhrsForRoute(waypoints, ato, cycleStr) {
    // For each WP, calculate the absolute fhr from cycle ref to its arrival time,
    // round to nearest 3h, deduplicate, and sort. This ensures the entire flight
    // is covered with appropriate forecast times.
    if (!ato || !cycleStr || cycleStr.length !== 10) return [];
    var y = parseInt(cycleStr.slice(0, 4), 10);
    var m = parseInt(cycleStr.slice(4, 6), 10) - 1;
    var d = parseInt(cycleStr.slice(6, 8), 10);
    var h = parseInt(cycleStr.slice(8, 10), 10);
    var cycleMs = Date.UTC(y, m, d, h, 0, 0);
    var seen = {};
    for (var i = 0; i < waypoints.length; i++) {
      var ctme = waypoints[i].ctme;
      if (typeof ctme !== 'number' || isNaN(ctme)) continue;
      var validMs = ato.getTime() + ctme * 60000;
      var hrs = (validMs - cycleMs) / 3600000;
      if (hrs < 0) hrs = 0;
      if (hrs > 384) hrs = 384;
      var rounded = Math.round(hrs / 3) * 3;
      if (rounded < 0) rounded = 0;
      if (rounded > 384) rounded = 384;
      seen[rounded] = true;
    }
    var arr = [];
    for (var k in seen) {
      if (seen.hasOwnProperty(k)) arr.push(parseInt(k, 10));
    }
    arr.sort(function (a, b) { return a - b; });
    return arr;
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
    var lonN = normalizeLongitudeForGridExtent(lon, lo1, lo2);
    var iy = (la1 - lat) / dlat;
    var ix = (lonN - lo1) / dlon;
    // Floating point tolerance at the boundary.
    var eps = 1e-9;
    if (ix < -eps || ix > nx - 1 + eps || iy < -eps || iy > ny - 1 + eps) return null;
    if (ix < 0) ix = 0;
    if (ix > nx - 1) ix = nx - 1;
    if (iy < 0) iy = 0;
    if (iy > ny - 1) iy = ny - 1;
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

  function isRetryableStatus(status) {
    return status === 502 || status === 503 || status === 504;
  }

  function isNetworkError(err) {
    if (!err) return false;
    if (err.name === 'TypeError') return true;
    var msg = String(err.message || err);
    return /network|fetch|timeout|failed/i.test(msg);
  }

  function fetchJsonWithRetry(url, info, maxRetries) {
    function run(attempt) {
      return fetch(url, { method: 'GET', cache: 'default' }).then(function(r) {
        if (!r.ok) {
          var e = new Error('HTTP ' + r.status);
          e.status = r.status;
          throw e;
        }
        return r.json();
      }).catch(function(err) {
        var status = (err && typeof err.status === 'number') ? err.status : null;
        var canRetry = (attempt < maxRetries) && (isRetryableStatus(status) || isNetworkError(err));
        if (!canRetry) throw err;
        var waitMs = Math.pow(2, attempt) * 500; // 500, 1000, 2000...
        var statusLabel = status ? status : 'network';
        console.warn('[GFS] retry ' + (attempt + 1) + '/' + maxRetries +
          ' after ' + statusLabel + ' for level=' + info.lev + ' fhr=' + info.fhr);
        return new Promise(function(resolve) {
          setTimeout(resolve, waitMs);
        }).then(function() {
          return run(attempt + 1);
        });
      }).then(function(json) {
        if (!json || !json.grid || !json.vars) return null;
        return { meta: json.meta, grid: json.grid, vars: json.vars };
      });
    }
    return run(0);
  }

  function gfsLoad(waypoints, ato, done, opts) {
    if (!waypoints || waypoints.length < 2) return;
    if (!ato || !(ato instanceof Date) || isNaN(ato.getTime())) return;
    opts = opts || {};
    var padDeg = typeof opts.padDeg === 'number' ? opts.padDeg : 3.3;
    var box = bboxFromWaypoints(waypoints, padDeg);
    if (!box) return;

    var cycle = pickGfsCycle(ato);
    var fhrs = calcFhrsForRoute(waypoints, ato, cycle);
    if (fhrs.length === 0) fhrs = [0];
    var t0 = Date.now();

    global.GFS = {
      status: 'loading',
      cycle: cycle,
      ato: ato,
      bbox: box,
      padDeg: padDeg,
      levelsMb: LEVELS_MB.slice(),
      fhrs: fhrs.slice(),
      slices: [],
      startedMs: t0
    };

    var reqs = [];
    var tasks = [];
    var fi, li, fhr, lev;
    for (fi = 0; fi < fhrs.length; fi++) {
      fhr = fhrs[fi];
      for (li = 0; li < LEVELS_MB.length; li++) {
        lev = LEVELS_MB[li];
        reqs.push({ url: gfsUrl(cycle, fhr, lev, box), fhr: fhr, lev: lev });
      }
    }

    var maxRetries = 3;
    for (fi = 0; fi < reqs.length; fi++) {
      (function(req) {
      tasks.push(
        fetchJsonWithRetry(req.url, req, maxRetries)
      );
      })(reqs[fi]);
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
      global.GFS.urls = reqs.map(function(r) { return r.url; });
      console.log('[GFS] ready ' + out.length + '/' + reqs.length + ' slices, ' + global.GFS.elapsedMs + 'ms cycle=' + cycle);
      if (typeof done === 'function') done(null, global.GFS);
    }).catch(function(err) {
      global.GFS.status = 'error';
      global.GFS.error = String(err && err.message ? err.message : err);
      console.error('[GFS] load failed:', err);
      if (typeof done === 'function') done(err);
    });
  }

  global.gfsLoad = gfsLoad;
  global.gfsValueAt = gfsValueAt;
  global.gfsNormalizeLongitudeForGridExtent = normalizeLongitudeForGridExtent;
})(typeof window !== 'undefined' ? window : this);
