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

  function minDistToRouteNM(lat, lon, wps) {
    if (!wps || !wps.length) return 0;
    var minD = Infinity;
    for (var i = 0; i < wps.length; i++) {
      var w = wps[i];
      if (typeof w.lat !== 'number') continue;
      var wLon = (typeof w.lngU === 'number' && !isNaN(w.lngU))
        ? w.lngU
        : ((typeof w.lon === 'number') ? w.lon : w.lng);
      if (typeof wLon !== 'number' || isNaN(wLon)) continue;
      var cellLon = lon;
      while (cellLon - wLon > 180) cellLon -= 360;
      while (wLon - cellLon > 180) cellLon += 360;
      var d = approxDistNM(lat, cellLon, w.lat, wLon);
      if (d < minD) minD = d;
    }
    return minD;
  }

  function findSlice(fhr, levMb) {
    var s = window.GFS && window.GFS.slices;
    if (!s) return null;
    for (var i = 0; i < s.length; i++) {
      if (s[i].meta.fhr === fhr && s[i].meta.lev === levMb) return s[i];
    }
    return null;
  }

  // Find fhr in slices closest to the given valid time.
  function nearestFhr(validUtc) {
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
    var sCenter = findSlice(fhr, centerMb);
    if (!sCenter) return null;
    var g = sCenter.grid;
    var nx = g.nx, ny = g.ny;
    if (ix < 0 || ix >= nx || iy < 0 || iy >= ny) return null;
    var idx = iy * nx + ix;

    var u = sCenter.vars.UGRD[idx];
    var v = sCenter.vars.VGRD[idx];
    var t = sCenter.vars.TMP[idx];
    var h = sCenter.vars.HGT[idx];
    if (u === null || v === null || u === undefined || v === undefined) return null;

    // VWS via centered-or-one-sided difference between adjacent levels in our set.
    var sUp = ci > 0 ? findSlice(fhr, levs[ci - 1]) : null;            // smaller mb = higher alt
    var sDn = ci < levs.length - 1 ? findSlice(fhr, levs[ci + 1]) : null; // larger mb = lower alt
    var vws = null;
    var uA, vA, hA, uB, vB, hB;
    if (sUp && sDn) {
      uA = sUp.vars.UGRD[idx]; vA = sUp.vars.VGRD[idx]; hA = sUp.vars.HGT[idx];
      uB = sDn.vars.UGRD[idx]; vB = sDn.vars.VGRD[idx]; hB = sDn.vars.HGT[idx];
    } else if (sUp) {
      uA = sUp.vars.UGRD[idx]; vA = sUp.vars.VGRD[idx]; hA = sUp.vars.HGT[idx];
      uB = u; vB = v; hB = h;
    } else if (sDn) {
      uA = u; vA = v; hA = h;
      uB = sDn.vars.UGRD[idx]; vB = sDn.vars.VGRD[idx]; hB = sDn.vars.HGT[idx];
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
    var ue = sCenter.vars.UGRD[iy * nx + ix1];
    var uw = sCenter.vars.UGRD[iy * nx + ix0];
    var un = sCenter.vars.UGRD[iy1 * nx + ix];
    var us = sCenter.vars.UGRD[iy0 * nx + ix];
    var ve = sCenter.vars.VGRD[iy * nx + ix1];
    var vw = sCenter.vars.VGRD[iy * nx + ix0];
    var vn = sCenter.vars.VGRD[iy1 * nx + ix];
    var vs = sCenter.vars.VGRD[iy0 * nx + ix];

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
    if (!window.GFS || !window.GFS.slices || !window.GFS.slices.length) {
      console.warn('[GfsRadar] no GFS data loaded; call gfsLoad() first');
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

    var sCenter = findSlice(fhr, levelMb);
    if (!sCenter) {
      console.warn('[GfsRadar] no slice for fhr=' + fhr + ' lev=' + levelMb);
      return null;
    }
    var g = sCenter.grid;
    var dlat = (g.la2 - g.la1) / (g.ny - 1);
    var dlon = (g.lo2 - g.lo1) / (g.nx - 1);

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
          if (minDistToRouteNM(lat, lon, routeWps) > corridorNM) {
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
