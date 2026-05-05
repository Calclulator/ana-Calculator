// gfs-radar-layer.js — Canvas field from window.GFS + gfsValueAt (Leaflet image overlay)
// ES5. Depends: gfs-client.js (gfsValueAt, window.GFS).
//
// Public: window.GfsRadar.render(map, opts) -> L.ImageOverlay | null
//   opts.method  'VWS' | 'TI1' | 'TI2'
//   opts.fl      flight level (e.g. 35 for FL350); ignored if opts.levelMb set
//   opts.levelMb optional pressure (hPa) — bypasses FL→pressure (debug / console tests)
//   opts.validUtc Date (UTC) for gfsValueAt slice pick
// Preconditions: Flight Plan Apply completed gfsLoad; window.GFS.status === 'ready'.
//
// VWS: |Delta V| between pressure surfaces ~FL and FL-10 (1000 ft), kt (wind m/s * 1.94384).
// TI1: total deformation * |relative vorticity| at cruise pressure (finite differences).
// TI2: TI1 scaled by divergence magnitude (empirical blend for display).
//
// Canvas is downsampled (nx~88) for mobile; increase nx in render() for sharper desktop fields.

var GfsRadar = (function() {
  var D2R = Math.PI / 180;
  var MS_TO_KT = 1.94384;

  function flToPressureHpa(fl) {
    var zM = fl * 30.48;
    return 1013.25 * Math.pow(Math.max(1e-6, 1 - 2.25577e-5 * zM), 5.25588);
  }

  function sortedLevelsFromGfs() {
    var G = window.GFS;
    if (!G || !G.levelsMb || !G.levelsMb.length) return [150, 200, 250, 300];
    return G.levelsMb.slice().sort(function(a, b) { return a - b; });
  }

  function bracketPressureMb(pMb) {
    var L = sortedLevelsFromGfs();
    var n = L.length;
    if (n === 1) return { lo: L[0], hi: L[0] };
    if (pMb <= L[0]) return { lo: L[0], hi: L[0] };
    if (pMb >= L[n - 1]) return { lo: L[n - 1], hi: L[n - 1] };
    var i;
    for (i = 0; i < n - 1; i++) {
      if (pMb >= L[i] && pMb <= L[i + 1]) return { lo: L[i], hi: L[i + 1] };
    }
    return { lo: L[n - 2], hi: L[n - 1] };
  }

  function gfsVal(lat, lon, levMb, varName, validUtc) {
    if (typeof gfsValueAt !== 'function') return null;
    return gfsValueAt(lat, lon, levMb, varName, validUtc);
  }

  function windUvAtP(lat, lon, pMb, validUtc) {
    var br = bracketPressureMb(pMb);
    var u0 = gfsVal(lat, lon, br.lo, 'UGRD', validUtc);
    var v0 = gfsVal(lat, lon, br.lo, 'VGRD', validUtc);
    if (u0 === null || v0 === null || isNaN(u0) || isNaN(v0)) return null;
    if (br.lo === br.hi) return { u: u0, v: v0 };
    var u1 = gfsVal(lat, lon, br.hi, 'UGRD', validUtc);
    var v1 = gfsVal(lat, lon, br.hi, 'VGRD', validUtc);
    if (u1 === null || v1 === null || isNaN(u1) || isNaN(v1)) return null;
    var f = (pMb - br.lo) / (br.hi - br.lo);
    return { u: u0 + f * (u1 - u0), v: v0 + f * (v1 - v0) };
  }

  function scalarVwsKt(lat, lon, fl, validUtc) {
    var pHi = flToPressureHpa(fl);
    var pLo = flToPressureHpa(fl - 10);
    var wHi = windUvAtP(lat, lon, pHi, validUtc);
    var wLo = windUvAtP(lat, lon, pLo, validUtc);
    if (!wHi || !wLo) return null;
    var du = (wHi.u - wLo.u) * MS_TO_KT;
    var dv = (wHi.v - wLo.v) * MS_TO_KT;
    var mag = Math.sqrt(du * du + dv * dv);
    return mag;
  }

  /** VWS between cruiseMb (upper air) and cruiseMb + DELTA (≈1000 ft lower). */
  function scalarVwsKtFromMb(lat, lon, cruiseMb, validUtc) {
    var DELTA_MB = 42;
    var pUpper = cruiseMb;
    var pLower = cruiseMb + DELTA_MB;
    var wHi = windUvAtP(lat, lon, pUpper, validUtc);
    var wLo = windUvAtP(lat, lon, pLower, validUtc);
    if (!wHi || !wLo) return null;
    var du = (wHi.u - wLo.u) * MS_TO_KT;
    var dv = (wHi.v - wLo.v) * MS_TO_KT;
    return Math.sqrt(du * du + dv * dv);
  }

  function metersPerDegLon(lat) {
    return 6371000 * Math.cos(lat * D2R) * D2R;
  }

  function metersPerDegLat() {
    return 6371000 * D2R;
  }

  function ellrodDerivs(lat, lon, levMb, validUtc, dDeg) {
    var dx = metersPerDegLon(lat) * dDeg;
    var dy = metersPerDegLat() * dDeg;
    if (dx < 1e3 || dy < 1e3) return null;
    var u = function(la, lo) { return gfsVal(la, lo, levMb, 'UGRD', validUtc); };
    var v = function(la, lo) { return gfsVal(la, lo, levMb, 'VGRD', validUtc); };
    var uc = u(lat, lon);
    var vc = v(lat, lon);
    var ue = u(lat, lon + dDeg);
    var uw = u(lat, lon - dDeg);
    var vn = v(lat + dDeg, lon);
    var vs = v(lat - dDeg, lon);
    if ([uc, vc, ue, uw, vn, vs].some(function(x) { return x === null || isNaN(x); })) return null;
    var dudx = (ue - uw) / (2 * dx);
    var dvdy = (vn - vs) / (2 * dy);
    var dudy = (u(lat + dDeg, lon) - u(lat - dDeg, lon)) / (2 * dy);
    var dvdx = (v(lat, lon + dDeg) - v(lat, lon - dDeg)) / (2 * dx);
    if ([dudy, dvdx].some(function(x) { return x === null || isNaN(x); })) return null;
    return { dudx: dudx, dvdy: dvdy, dudy: dudy, dvdx: dvdx };
  }

  function ellrodTi1(lat, lon, levMb, validUtc, dDeg) {
    var d = ellrodDerivs(lat, lon, levMb, validUtc, dDeg);
    if (!d) return null;
    var dst = (d.dvdx + d.dudy);
    var dsh = (d.dudx - d.dvdy);
    var def = Math.sqrt(dst * dst + dsh * dsh);
    var vor = d.dvdx - d.dudy;
    return def * Math.abs(vor);
  }

  function ellrodTi2(lat, lon, levMb, validUtc, dDeg) {
    var d = ellrodDerivs(lat, lon, levMb, validUtc, dDeg);
    if (!d) return null;
    var dst = (d.dvdx + d.dudy);
    var dsh = (d.dudx - d.dvdy);
    var def = Math.sqrt(dst * dst + dsh * dsh);
    var vor = d.dvdx - d.dudy;
    var ti1 = def * Math.abs(vor);
    if (ti1 === null || isNaN(ti1)) return null;
    var div = d.dudx + d.dvdy;
    return ti1 * (1 + 0.35 * Math.abs(div));
  }

  function cruiseLevMb(fl) {
    return flToPressureHpa(fl);
  }

  function rgbaVws(v) {
    if (v === null || isNaN(v)) return [0, 0, 0, 0];
    var t = Math.max(0, Math.min(1, v / 18));
    var r, g, b;
    if (t < 0.22) {
      r = 100 + 80 * (t / 0.22);
      g = 181 + 30 * (t / 0.22);
      b = 246;
    } else if (t < 0.44) {
      r = 102 + 72 * ((t - 0.22) / 0.22);
      g = 187 + 26 * ((t - 0.22) / 0.22);
      b = 106;
    } else if (t < 0.66) {
      r = 174 + 81 * ((t - 0.44) / 0.22);
      g = 213 - 18 * ((t - 0.44) / 0.22);
      b = 129;
    } else if (t < 0.88) {
      r = 255;
      g = 238 - 71 * ((t - 0.66) / 0.22);
      b = 88 - 24 * ((t - 0.66) / 0.22);
    } else {
      r = 239;
      g = 83 + 84 * ((t - 0.88) / 0.12);
      b = 80;
    }
    return [Math.round(r), Math.round(g), Math.round(b), 200];
  }

  function rgbaTi(logNorm) {
    if (logNorm === null || isNaN(logNorm)) return [0, 0, 0, 0];
    var t = Math.max(0, Math.min(1, logNorm / 12));
    var r = Math.round(100 + 139 * t);
    var g = Math.round(181 - 98 * t);
    var b = Math.round(246 - 166 * t);
    return [r, g, b, 200];
  }

  function sampleScalar(methodKey, lat, lon, fl, validUtc, dDeg, levMb, vwsUseDirectMb) {
    if (methodKey === 'VWS') {
      if (vwsUseDirectMb) return scalarVwsKtFromMb(lat, lon, levMb, validUtc);
      return scalarVwsKt(lat, lon, fl, validUtc);
    }
    if (methodKey === 'TI1') return ellrodTi1(lat, lon, levMb, validUtc, dDeg);
    if (methodKey === 'TI2') return ellrodTi2(lat, lon, levMb, validUtc, dDeg);
    return null;
  }

  function paintCanvas(bbox, nx, ny, methodKey, fl, validUtc, levelMbOpt) {
    var south = bbox.south;
    var north = bbox.north;
    var west = bbox.west;
    var east = bbox.east;
    var dLat = (north - south) / Math.max(1, ny - 1);
    var dLon = (east - west) / Math.max(1, nx - 1);
    var levMb = (typeof levelMbOpt === 'number' && !isNaN(levelMbOpt))
      ? levelMbOpt
      : cruiseLevMb(fl);
    var vwsUseDirectMb = typeof levelMbOpt === 'number' && !isNaN(levelMbOpt);
    var dDeg = 0.12;
    var c = document.createElement('canvas');
    c.width = nx;
    c.height = ny;
    var ctx = c.getContext('2d');
    var img = ctx.createImageData(nx, ny);
    var data = img.data;
    var ix, iy, lat, lon, sc, rgba, p, logn;
    for (iy = 0; iy < ny; iy++) {
      lat = north - iy * dLat;
      for (ix = 0; ix < nx; ix++) {
        lon = west + ix * dLon;
        sc = sampleScalar(methodKey, lat, lon, fl, validUtc, dDeg, levMb, vwsUseDirectMb);
        if (methodKey === 'VWS') rgba = rgbaVws(sc);
        else {
          logn = sc === null || sc <= 0 ? null : Math.log(sc + 1e-18) + 18;
          rgba = rgbaTi(logn);
        }
        p = (iy * nx + ix) * 4;
        data[p] = rgba[0];
        data[p + 1] = rgba[1];
        data[p + 2] = rgba[2];
        data[p + 3] = rgba[3];
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function canRender() {
    var G = window.GFS;
    return !!(G && G.status === 'ready' && G.bbox && G.slices && G.slices.length);
  }

  function render(map, opts) {
    if (!map || !opts) return null;
    var G = window.GFS;
    if (!G || G.status !== 'ready' || !G.bbox) return null;
    var methodKey = opts.method;
    if (methodKey !== 'VWS' && methodKey !== 'TI1' && methodKey !== 'TI2') return null;
    var fl = typeof opts.fl === 'number' && !isNaN(opts.fl) ? opts.fl : 35;
    var levelMbOpt = null;
    if (typeof opts.levelMb === 'number' && !isNaN(opts.levelMb)) levelMbOpt = opts.levelMb;
    var validUtc = opts.validUtc instanceof Date ? opts.validUtc : new Date();
    var bbox = G.bbox;
    var nx = 88;
    var ny = Math.max(48, Math.round(88 * (bbox.north - bbox.south) / Math.max(0.5, bbox.east - bbox.west)));
    if (ny > 120) ny = 120;
    var canvas = paintCanvas(bbox, nx, ny, methodKey, fl, validUtc, levelMbOpt);
    var url = canvas.toDataURL('image/png');
    var bounds = L.latLngBounds(
      [bbox.south, bbox.west],
      [bbox.north, bbox.east]
    );
    var layer = L.imageOverlay(url, bounds, {
      opacity: 0.58,
      interactive: false,
      className: 'gfs-radar-field'
    });
    layer.addTo(map);
    return layer;
  }

  return { render: render, canRender: canRender, version: '1.0.0' };
})();

if (typeof window !== 'undefined') window.GfsRadar = GfsRadar;
