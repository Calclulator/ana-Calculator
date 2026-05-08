// gfs-radar-layer.js
// Leaflet layer drawing GFS-derived turbulence indices (VWS / Ellrod TI1 / TI2)
// as colored 0.25-deg cells. Reads window.GFS.slices populated by gfsLoad().
//
// Usage:
//   var layer = GfsRadar.render(map, { method: 'VWS', fl: 360, validUtc: new Date() });
//   layer.remove();   // when switching method/altitude
// ES5 only, no 全角 quotes.

(function () {
  'use strict';

  var R_EARTH_M = 6371008.8;

  // Approximate ICAO standard atmosphere FL -> mb.
  // Used to map cockpit-friendly FLs to the 4 GFS pressure levels we have.
  var FL_TABLE = [
    [250, 376], [270, 344], [290, 315], [300, 301],
    [310, 287], [320, 274], [330, 261], [340, 250],
    [350, 238], [360, 227], [370, 217], [380, 207],
    [390, 197], [400, 188], [410, 179], [420, 170],
    [430, 162], [440, 154], [450, 147]
  ];
  var GFS_LEVELS = [300, 250, 200, 150];

  // Default 6-bucket palette (Severe -> Smooth)
  var PALETTE = [
    '#7e0023', // 0 Severe
    '#cf2027', // 1 Heavy
    '#ed6f23', // 2 Moderate
    '#f7c84a', // 3 Light
    '#9bd06f', // 4 Minimal
    '#3a78f0'  // 5 Smooth
  ];

  // Thresholds: bucket 0 if v >= thr[0], 1 if >= thr[1], ..., 5 if v < thr[4].
  // GFS-VWS calibrated thresholds in s^-1:
  // Smooth <0.004, Light- <0.006, Light <0.008, Light+ <0.010, Moderate <0.013, Severe >=0.013
  var VWS_THRESH = [0.013, 0.010, 0.008, 0.006, 0.004];
  // Ellrod values: raw multiplied by 1e7 for human-readable thresholding.
  var TI1_THRESH = [50, 30, 15, 8, 3];
  var TI2_THRESH = [70, 40, 20, 10, 5];
  var LAST_RENDER_LOG = null;

  function normalizeMethod(method) {
    var m = String(method || 'VWS').toUpperCase();
    if (m === 'TI1' || m === 'TI2') return m;
    return 'VWS';
  }

  function thresholdsForMethod(method) {
    var m = normalizeMethod(method);
    if (m === 'TI1') return TI1_THRESH.slice();
    if (m === 'TI2') return TI2_THRESH.slice();
    return VWS_THRESH.slice();
  }

  function labelsForMethod(method) {
    var m = normalizeMethod(method);
    if (m === 'VWS') {
      return ['Severe (13+)', 'Moderate (10-12)', 'Light+ (8-9)', 'Light (6-7)', 'Light- (4-5)', 'Smooth (0-3)'];
    }
    if (m === 'TI1') {
      return ['Severe (50+)', 'Heavy (30-49)', 'Moderate (15-29)', 'Light (8-14)', 'Minimal (3-7)', 'Smooth (0-2)'];
    }
    return ['Severe (70+)', 'Heavy (40-69)', 'Moderate (20-39)', 'Light (10-19)', 'Minimal (5-9)', 'Smooth (0-4)'];
  }

  function flToMb(fl) {
    if (fl <= FL_TABLE[0][0]) return FL_TABLE[0][1];
    var n = FL_TABLE.length;
    if (fl >= FL_TABLE[n - 1][0]) return FL_TABLE[n - 1][1];
    for (var i = 1; i < n; i++) {
      if (fl <= FL_TABLE[i][0]) {
        var f0 = FL_TABLE[i - 1][0], m0 = FL_TABLE[i - 1][1];
        var f1 = FL_TABLE[i][0],     m1 = FL_TABLE[i][1];
        var t = (fl - f0) / (f1 - f0);
        return m0 + t * (m1 - m0);
      }
    }
    return FL_TABLE[n - 1][1];
  }

  // Snap arbitrary mb to one of GFS_LEVELS (closest by log pressure).
  function snapLevel(mb) {
    var best = GFS_LEVELS[0], bestDiff = 1e9;
    for (var i = 0; i < GFS_LEVELS.length; i++) {
      var d = Math.abs(Math.log(GFS_LEVELS[i]) - Math.log(mb));
      if (d < bestDiff) { bestDiff = d; best = GFS_LEVELS[i]; }
    }
    return best;
  }

  function bucket(value, thr) {
    if (value === null || value === undefined || isNaN(value)) return -1;
    for (var i = 0; i < thr.length; i++) {
      if (value >= thr[i]) return i;
    }
    return thr.length;
  }

  function colorFor(method, value) {
    if (value === null || value === undefined || isNaN(value)) return null;
    if (method === 'TI1') {
      return PALETTE[Math.min(bucket(value * 1e7, TI1_THRESH), PALETTE.length - 1)];
    } else if (method === 'TI2') {
      return PALETTE[Math.min(bucket(value * 1e7, TI2_THRESH), PALETTE.length - 1)];
    } else {
      return PALETTE[Math.min(bucket(value, VWS_THRESH), PALETTE.length - 1)];
    }
  }

  function colorForMethod(method, value) {
    return colorFor(normalizeMethod(method), value);
  }

  // CSV / UI 用: Severe / Heavy / … の短いカテゴリ名 (ラベル文字列の括弧前を返す)
  function bandCategoryShort(method, rawVal) {
    if (rawVal === null || rawVal === undefined || isNaN(rawVal)) return '';
    var m = normalizeMethod(method);
    var thr = thresholdsForMethod(m);
    var labels = labelsForMethod(m);
    var v = rawVal;
    if (m === 'TI1' || m === 'TI2') v = rawVal * 1e7;
    var idx = bucket(v, thr);
    idx = Math.min(idx, labels.length - 1);
    var lab = labels[idx];
    var p = lab.indexOf(' (');
    return p >= 0 ? lab.slice(0, p) : lab;
  }

  // 凡例・セル着色用 0..5 (PALETTE インデックスと一致)
  function bucketCategoryIndex(method, rawVal) {
    if (rawVal === null || rawVal === undefined || isNaN(rawVal)) return -1;
    var m = normalizeMethod(method);
    var thr = thresholdsForMethod(m);
    var v = rawVal;
    if (m === 'TI1' || m === 'TI2') v = rawVal * 1e7;
    var idx = bucket(v, thr);
    return Math.min(idx, PALETTE.length - 1);
  }

  function approxDistNM(lat1, lon1, lat2, lon2) {
    var avgLat = (lat1 + lat2) * 0.5;
    var dLat = (lat2 - lat1) * 60.0;
    var dLon = lon2 - lon1;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    var dLonNM = dLon * 60.0 * Math.cos(avgLat * Math.PI / 180);
    return Math.sqrt(dLat * dLat + dLonNM * dLonNM);
  }

  // Planar (equirectangular) point-to-segment distance.
  // Accuracy is sufficient for the corridor padding (e.g. <= ~200NM width).
  function pointToSegmentDistNM(pLat, pLon, aLat, aLon, bLat, bLon) {
    var DEG2RAD = Math.PI / 180;
    var NM_M = 1852;

    var latP = pLat * DEG2RAD;
    var lonP = pLon * DEG2RAD;
    var latA = aLat * DEG2RAD;
    var lonA = aLon * DEG2RAD;
    var latB = bLat * DEG2RAD;
    var lonB = bLon * DEG2RAD;

    var latMean = (latA + latB) * 0.5;
    var cosMean = Math.cos(latMean);

    var pX = lonP * cosMean;
    var pY = latP;
    var aX = lonA * cosMean;
    var aY = latA;
    var bX = lonB * cosMean;
    var bY = latB;

    var abX = bX - aX;
    var abY = bY - aY;
    var len2 = abX * abX + abY * abY;
    if (len2 === 0) {
      // Segment is a point
      var dx = pX - aX;
      var dy = pY - aY;
      var rad = Math.sqrt(dx * dx + dy * dy);
      return rad * R_EARTH_M / NM_M;
    }

    var t = ((pX - aX) * abX + (pY - aY) * abY) / len2;
    if (t < 0) t = 0;
    if (t > 1) t = 1;

    var cX = aX + t * abX;
    var cY = aY + t * abY;
    var dX = pX - cX;
    var dY = pY - cY;
    var dRad = Math.sqrt(dX * dX + dY * dY);
    return dRad * R_EARTH_M / NM_M;
  }

  function unwrapLonForSegment(lon1, lon2) {
    // Shift lon2 by +-360 so that (lon2-lon1) is within [-180,180] for the "short" path.
    var d = lon2 - lon1;
    while (d > 180) { lon2 -= 360; d = lon2 - lon1; }
    while (d < -180) { lon2 += 360; d = lon2 - lon1; }
    return lon2;
  }

  function wpLonForFilter(w) {
    var lon = (typeof w.lngU === 'number' && !isNaN(w.lngU)) ? w.lngU : ((typeof w.lon === 'number') ? w.lon : w.lng);
    if (typeof lon !== 'number' || isNaN(lon)) return null;
    // Convert to a common base domain when possible. (If lon is unwrapped already, keep it.)
    if (lon < 0) lon += 360;
    return lon;
  }

  function minDistToRoutePolylineNM(lat, lon, wps, corridorNM) {
    if (!wps || wps.length < 2) return 0;
    var minD = Infinity;
    var segOffsets = [-360, 0, 360];

    for (var i = 0; i < wps.length - 1; i++) {
      var a = wps[i];
      var b = wps[i + 1];
      if (!a || !b) continue;
      if (typeof a.lat !== 'number' || typeof b.lat !== 'number') continue;

      var aLon = wpLonForFilter(a);
      var bLon = wpLonForFilter(b);
      if (aLon === null || bLon === null) continue;

      // Ensure segment is the short-way around the dateline.
      bLon = unwrapLonForSegment(aLon, bLon);

      for (var oi = 0; oi < segOffsets.length; oi++) {
        var off = segOffsets[oi];
        var d = pointToSegmentDistNM(lat, lon, a.lat, aLon + off, b.lat, bLon + off);
        if (d < minD) minD = d;
        // Early exit: once inside corridor width, no need to check further.
        if (corridorNM != null && isFinite(corridorNM) && minD <= corridorNM) return minD;
      }
    }
    return minD;
  }

  function hasGrid() {
    return !!(window.GFS_GRID && window.GFS_GRID.status === 'ready' && window.GFS_GRID.data);
  }

  function findSlice(fhr, levMb) {
    // legacy NOMADS path
    var s = window.GFS && window.GFS.slices;
    if (!s) return null;
    for (var i = 0; i < s.length; i++) {
      if (s[i].meta.fhr === fhr && s[i].meta.lev === levMb) return s[i];
    }
    return null;
  }

  function gridLevelIndex(levMb) {
    var gd = window.GFS_GRID && window.GFS_GRID.data;
    if (!gd || !gd.levels) return -1;
    for (var i = 0; i < gd.levels.length; i++) {
      if (gd.levels[i] && gd.levels[i].mb === levMb) return i;
    }
    return -1;
  }

  function gridAt(fhr, levMb, ix, iy) {
    var gd = window.GFS_GRID && window.GFS_GRID.data;
    if (!gd || gd.fhr !== fhr) return null;
    if (!gd.levels || !gd.levels.length) return null;
    if (ix < 0 || ix >= gd.nlon || iy < 0 || iy >= gd.nlat) return null;
    var li = gridLevelIndex(levMb);
    if (li < 0) return null;
    var lv = gd.levels[li];
    if (!lv) return null;
    function at2(a) {
      if (!a || !a.length) return null;
      var row = a[iy];
      if (!row || !row.length) return null;
      var v = row[ix];
      return (v === null || v === undefined || isNaN(v)) ? null : v;
    }
    var u = at2(lv.u_ms);
    var v = at2(lv.v_ms);
    var t = at2(lv.tmp_k);
    var h = at2(lv.hgt_m);
    if (u === null || v === null) return null;
    return { u: u, v: v, t: t, h: h };
  }

  // Find fhr in slices closest to the given valid time.
  function nearestFhr(validUtc) {
    if (hasGrid()) {
      var gd = window.GFS_GRID.data;
      if (!gd || typeof gd.fhr !== 'number') return null;
      return gd.fhr;
    }
    var s = window.GFS && window.GFS.slices;
    if (!s || !s.length) return null;
    var ref = s[0].meta.refTime;
    var refMs = Date.UTC(ref.year, ref.month - 1, ref.day, ref.hour, ref.minute || 0, ref.second || 0);
    var diffH = (validUtc.getTime() - refMs) / 3600000;
    var bestFhr = null, bestDiff = 1e9;
    var seen = {};
    for (var i = 0; i < s.length; i++) {
      var f = s[i].meta.fhr;
      if (seen[f]) continue;
      seen[f] = 1;
      var d = Math.abs(diffH - f);
      if (d < bestDiff) { bestDiff = d; bestFhr = f; }
    }
    return bestFhr;
  }

  // List of available levels for a given fhr (sorted ascending mb = descending altitude).
  function levelsForFhr(fhr) {
    if (hasGrid()) {
      var gd = window.GFS_GRID.data;
      if (!gd || !gd.levels) return [];
      var out = [];
      for (var i = 0; i < gd.levels.length; i++) if (gd.levels[i]) out.push(gd.levels[i].mb);
      out.sort(function (a, b) { return a - b; });
      return out;
    }
    var s = window.GFS && window.GFS.slices;
    if (!s) return [];
    var levs = [];
    for (var i = 0; i < s.length; i++) {
      if (s[i].meta.fhr === fhr) levs.push(s[i].meta.lev);
    }
    levs.sort(function (a, b) { return a - b; });
    return levs;
  }

  // Compute VWS, DEF, CVG plus center U/V/T/H at grid cell (ix, iy)
  // Returns { vws, defm, cvg, u, v, t, h } or null if data missing.
  function computeAtCell(fhr, centerMb, ix, iy) {
    var levs = levelsForFhr(fhr);
    var ci = -1;
    for (var k = 0; k < levs.length; k++) if (levs[k] === centerMb) { ci = k; break; }
    if (ci < 0) return null;
    var u, v, t, h, nx, ny, g;
    if (hasGrid()) {
      var gd = window.GFS_GRID.data;
      nx = gd.nlon; ny = gd.nlat;
      if (ix < 0 || ix >= nx || iy < 0 || iy >= ny) return null;
      var cc = gridAt(fhr, centerMb, ix, iy);
      if (!cc) return null;
      u = cc.u; v = cc.v; t = cc.t; h = cc.h;
      g = {
        nx: nx,
        ny: ny,
        la1: gd.bbox.N,
        lo1: gd.bbox.W,
        la2: gd.bbox.S,
        lo2: gd.bbox.E
      };
    } else {
      var sCenter = findSlice(fhr, centerMb);
      if (!sCenter) return null;
      g = sCenter.grid;
      nx = g.nx; ny = g.ny;
      if (ix < 0 || ix >= nx || iy < 0 || iy >= ny) return null;
      var idx = iy * nx + ix;
      u = sCenter.vars.UGRD[idx];
      v = sCenter.vars.VGRD[idx];
      t = sCenter.vars.TMP[idx];
      h = sCenter.vars.HGT[idx];
      if (u === null || v === null || u === undefined || v === undefined) return null;
    }

    // VWS via centered-or-one-sided difference between adjacent levels in our set.
    var vws = null;
    var uA, vA, hA, uB, vB, hB;
    if (hasGrid()) {
      var upMb = ci > 0 ? levs[ci - 1] : null;
      var dnMb = ci < levs.length - 1 ? levs[ci + 1] : null;
      var up = upMb != null ? gridAt(fhr, upMb, ix, iy) : null;
      var dn = dnMb != null ? gridAt(fhr, dnMb, ix, iy) : null;
      if (up && dn) {
        uA = up.u; vA = up.v; hA = up.h;
        uB = dn.u; vB = dn.v; hB = dn.h;
      } else if (up) {
        uA = up.u; vA = up.v; hA = up.h;
        uB = u; vB = v; hB = h;
      } else if (dn) {
        uA = u; vA = v; hA = h;
        uB = dn.u; vB = dn.v; hB = dn.h;
      }
    } else {
      var sUp = ci > 0 ? findSlice(fhr, levs[ci - 1]) : null;            // smaller mb = higher alt
      var sDn = ci < levs.length - 1 ? findSlice(fhr, levs[ci + 1]) : null; // larger mb = lower alt
      var idx2 = iy * nx + ix;
      if (sUp && sDn) {
        uA = sUp.vars.UGRD[idx2]; vA = sUp.vars.VGRD[idx2]; hA = sUp.vars.HGT[idx2];
        uB = sDn.vars.UGRD[idx2]; vB = sDn.vars.VGRD[idx2]; hB = sDn.vars.HGT[idx2];
      } else if (sUp) {
        uA = sUp.vars.UGRD[idx2]; vA = sUp.vars.VGRD[idx2]; hA = sUp.vars.HGT[idx2];
        uB = u; vB = v; hB = h;
      } else if (sDn) {
        uA = u; vA = v; hA = h;
        uB = sDn.vars.UGRD[idx2]; vB = sDn.vars.VGRD[idx2]; hB = sDn.vars.HGT[idx2];
      }
    }
    if (uA !== undefined && uA !== null) {
      var dz = hA - hB;
      if (Math.abs(dz) > 1) {
        var du = uA - uB, dv = vA - vB;
        vws = Math.sqrt(du * du + dv * dv) / Math.abs(dz);
      }
    }

    // Spatial derivatives at center level (centered diff, one-sided at edges).
    var lat = g.la1 + iy * (g.la2 - g.la1) / (ny - 1);
    var dlat = (g.la2 - g.la1) / (ny - 1);
    var dlon = (g.lo2 - g.lo1) / (nx - 1);
    var dy_m = dlat * Math.PI / 180 * R_EARTH_M;
    var dx_m = dlon * Math.PI / 180 * R_EARTH_M * Math.cos(lat * Math.PI / 180);

    var ix0 = Math.max(0, ix - 1), ix1 = Math.min(nx - 1, ix + 1);
    var iy0 = Math.max(0, iy - 1), iy1 = Math.min(ny - 1, iy + 1);
    var ue, uw, un, us, ve, vw, vn, vs;
    if (hasGrid()) {
      var e = gridAt(fhr, centerMb, ix1, iy);
      var w = gridAt(fhr, centerMb, ix0, iy);
      var n1 = gridAt(fhr, centerMb, ix, iy1);
      var s1 = gridAt(fhr, centerMb, ix, iy0);
      if (!e || !w || !n1 || !s1) return null;
      ue = e.u; uw = w.u; un = n1.u; us = s1.u;
      ve = e.v; vw = w.v; vn = n1.v; vs = s1.v;
    } else {
      var sCenter2 = findSlice(fhr, centerMb);
      if (!sCenter2) return null;
      ue = sCenter2.vars.UGRD[iy * nx + ix1];
      uw = sCenter2.vars.UGRD[iy * nx + ix0];
      un = sCenter2.vars.UGRD[iy1 * nx + ix];
      us = sCenter2.vars.UGRD[iy0 * nx + ix];
      ve = sCenter2.vars.VGRD[iy * nx + ix1];
      vw = sCenter2.vars.VGRD[iy * nx + ix0];
      vn = sCenter2.vars.VGRD[iy1 * nx + ix];
      vs = sCenter2.vars.VGRD[iy0 * nx + ix];
    }

    var dUdx = (ue - uw) / ((ix1 - ix0) * dx_m);
    var dUdy = (un - us) / ((iy1 - iy0) * dy_m);
    var dVdx = (ve - vw) / ((ix1 - ix0) * dx_m);
    var dVdy = (vn - vs) / ((iy1 - iy0) * dy_m);

    var stretch = dUdx - dVdy;
    var shear = dVdx + dUdy;
    var defm = Math.sqrt(stretch * stretch + shear * shear);
    var cvg = -(dUdx + dVdy); // positive = converging

    return {
      vws: vws,
      defm: defm,
      cvg: cvg,
      u: u,
      v: v,
      t: (t !== null && t !== undefined) ? t - 273.15 : null,
      h: h
    };
  }

  function methodValue(method, c) {
    if (!c) return null;
    if (method === 'TI1') return (c.vws !== null) ? c.vws * c.defm : null;
    if (method === 'TI2') return (c.vws !== null) ? c.vws * (c.defm + Math.max(0, c.cvg)) : null;
    return c.vws;
  }

  function buildPopupHtml(method, c, levelMb, fl) {
    var spdMs = Math.sqrt(c.u * c.u + c.v * c.v);
    var spdKt = spdMs * 1.943844;
    // Wind direction = where wind is FROM, in degrees true.
    var dir = (Math.atan2(-c.u, -c.v) * 180 / Math.PI + 360) % 360;
    var lines = [];
    lines.push('<b>FL ' + (fl != null ? fl : '?') + ' (' + Math.round(levelMb) + ' mb)</b>');
    lines.push('Wind: ' + Math.round(dir) + '&deg; / ' + Math.round(spdKt) + ' kt');
    if (c.t !== null) lines.push('Temp: ' + c.t.toFixed(1) + ' &deg;C');
    if (c.h !== null && c.h !== undefined) lines.push('HGT: ' + Math.round(c.h) + ' m');
    if (c.vws !== null) lines.push('VWS: ' + (c.vws * 1000).toFixed(2) + ' /ks');
    if (method === 'TI1' || method === 'TI2') {
      var v = methodValue(method, c);
      if (v !== null) lines.push(method + ': ' + (v * 1e7).toFixed(2) + ' (&times;1e-7)');
    }
    return lines.join('<br>');
  }

  // Main render. Returns L.LayerGroup (already added to map).
  function render(map, opts) {
    if (!(hasGrid() || (window.GFS && window.GFS.slices && window.GFS.slices.length))) {
      console.warn('[GfsRadar] no GFS data loaded; call gfsGridLoad() or gfsLoad() first');
      return null;
    }
    if (typeof L === 'undefined' || !L.layerGroup) {
      console.warn('[GfsRadar] Leaflet not available');
      return null;
    }
    opts = opts || {};
    var method = (opts.method || 'VWS').toUpperCase();
    if (method !== 'VWS' && method !== 'TI1' && method !== 'TI2') method = 'VWS';

    var levelMb;
    if (opts.levelMb) {
      levelMb = snapLevel(opts.levelMb);
    } else if (opts.fl !== undefined && opts.fl !== null) {
      levelMb = snapLevel(flToMb(opts.fl));
    } else {
      levelMb = 250; // default
    }

    var validUtc = opts.validUtc || new Date();
    var fhr = nearestFhr(validUtc);
    if (fhr === null) {
      console.warn('[GfsRadar] no fhr available');
      return null;
    }

    var g, dlat, dlon;
    if (hasGrid()) {
      var gd = window.GFS_GRID.data;
      g = { nx: gd.nlon, ny: gd.nlat, la1: gd.bbox.N, la2: gd.bbox.S, lo1: gd.bbox.W, lo2: gd.bbox.E };
      dlat = (g.la2 - g.la1) / (g.ny - 1);
      dlon = (g.lo2 - g.lo1) / (g.nx - 1);
    } else {
      var sCenter = findSlice(fhr, levelMb);
      if (!sCenter) {
        console.warn('[GfsRadar] no slice for fhr=' + fhr + ' lev=' + levelMb);
        return null;
      }
      g = sCenter.grid;
      dlat = (g.la2 - g.la1) / (g.ny - 1);
      dlon = (g.lo2 - g.lo1) / (g.nx - 1);
    }

    var fillOpacity = opts.fillOpacity != null ? opts.fillOpacity : 0.35;
    var renderer = opts.renderer || (L.canvas ? L.canvas() : undefined);

    var group = L.layerGroup();
    var nDrawn = 0, nNull = 0;
    var t0 = Date.now();

    // For popup we need to know FL too
    var fl = (opts.fl !== undefined && opts.fl !== null) ? opts.fl : null;

    var corridorNM = (typeof opts.corridorNM === 'number') ? opts.corridorNM : 200;
    var routeWps = opts.routeWps || (typeof window.WP !== 'undefined' ? window.WP : null);
    var useFilter = !!(routeWps && routeWps.length && corridorNM > 0 && isFinite(corridorNM));
    var nFiltered = 0;

    var worldLngOffsets = [-360, 0, 360];

    for (var iy = 0; iy < g.ny; iy++) {
      var lat = g.la1 + iy * dlat;
      for (var ix = 0; ix < g.nx; ix++) {
        var lon = g.lo1 + ix * dlon;
        if (useFilter) {
          if (minDistToRoutePolylineNM(lat, lon, routeWps, corridorNM) > corridorNM) {
            nFiltered++;
            continue;
          }
        }
        var c = computeAtCell(fhr, levelMb, ix, iy);
        if (!c) { nNull++; continue; }
        var v = methodValue(method, c);
        var color = colorFor(method, v);
        if (!color) { nNull++; continue; }

        for (var iCopy = 0; iCopy < worldLngOffsets.length; iCopy++) {
          var off = worldLngOffsets[iCopy];
          var bounds = [
            [lat - dlat / 2, lon - dlon / 2 + off],
            [lat + dlat / 2, lon + dlon / 2 + off]
          ];
          var rectOpts = {
            color: color,
            fillColor: color,
            fillOpacity: fillOpacity,
            weight: 0,
            interactive: true
          };
          if (renderer) rectOpts.renderer = renderer;
          var rect = L.rectangle(bounds, rectOpts);

          (function (cellData) {
            rect.on('click', function (e) {
              var html = buildPopupHtml(method, cellData, levelMb, fl);
              L.popup().setLatLng(e.latlng).setContent(html).openOn(map);
            });
          })(c);

          rect.addTo(group);
          nDrawn++;
        }
      }
    }
    if (map) group.addTo(map);
    var logMsg = '[GfsRadar] ' + method + ' lev=' + levelMb +
                 ' fhr=' + fhr + ': ' + nDrawn + ' cells drawn, ' +
                 nNull + ' nodata, ' + nFiltered + ' outside corridor';
    // Suppress immediate duplicate logs from repeated render triggers.
    if (LAST_RENDER_LOG !== logMsg) {
      console.log(logMsg + ', in ' + (Date.now() - t0) + 'ms');
      LAST_RENDER_LOG = logMsg;
    }
    return group;
  }

  // Public API
  window.GfsRadar = {
    render: render,
    flToMb: flToMb,
    snapLevel: snapLevel,
    nearestFhr: nearestFhr,
    levelsForFhr: levelsForFhr,
    computeAtCell: computeAtCell,
    methodValue: methodValue,
    setPalette: function (arr) { if (arr && arr.length === 6) PALETTE = arr; },
    setThresholds: function (m, arr) {
      if (!arr || arr.length !== 5) return;
      var mm = normalizeMethod(m);
      if (mm === 'VWS') VWS_THRESH = arr;
      else if (mm === 'TI1') TI1_THRESH = arr;
      else if (mm === 'TI2') TI2_THRESH = arr;
    },
    getPalette: function (method) {
      return PALETTE.slice();
    },
    getThresholds: function (m) { return thresholdsForMethod(m); },
    getLabels: function (m) { return labelsForMethod(m); },
    getColor: function (m, value) { return colorForMethod(m, value); },
    bandCategoryShort: bandCategoryShort,
    bucketCategoryIndex: bucketCategoryIndex
  };
})();
