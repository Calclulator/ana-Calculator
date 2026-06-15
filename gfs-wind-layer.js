// gfs-wind-layer.js — GFS wind barb overlay for WX Radar (ES5)
(function() {
  'use strict';

  var MS_TO_KT = 1.94384;
  var STAFF_LEN = 30;
  var PEN_LEN = 12;
  var SHORT_PEN = 6;

  function windFlToMb(fl) {
    if (fl === 400) return 250;
    if (fl === 350) return 300;
    if (fl === 300) return 300;
    if (typeof window.GfsRadar !== 'undefined' && window.GfsRadar.flToMb) {
      return window.GfsRadar.flToMb(fl);
    }
    return 300;
  }

  function interpLevel(levels, levMb) {
    if (!levels || !levels.length) return null;
    var i, lv;
    for (i = 0; i < levels.length; i++) {
      if (levels[i].mb === levMb) return levels[i];
    }
    for (i = 0; i < levels.length - 1; i++) {
      if (levels[i].mb <= levMb && levels[i + 1].mb >= levMb) {
        var lo = levels[i];
        var hi = levels[i + 1];
        var f = (levMb - lo.mb) / (hi.mb - lo.mb);
        return {
          mb: levMb,
          u: lo.u + (hi.u - lo.u) * f,
          v: lo.v + (hi.v - lo.v) * f,
          t: lo.t + (hi.t - lo.t) * f
        };
      }
    }
    if (levMb <= levels[0].mb) return levels[0];
    return levels[levels.length - 1];
  }

  function windSampleAt(lat, lon, levMb, validUtc) {
    var u = null;
    var v = null;
    var t = null;
    if (typeof gfsValueAt === 'function') {
      u = gfsValueAt(lat, lon, levMb, 'UGRD', validUtc);
      v = gfsValueAt(lat, lon, levMb, 'VGRD', validUtc);
      t = gfsValueAt(lat, lon, levMb, 'TMP', validUtc);
      if (u !== null && v !== null && !isNaN(u) && !isNaN(v) && t !== null && !isNaN(t)) {
        return { u: u, v: v, t: t };
      }
    }
    if (typeof gfsPointCached === 'function') {
      var pt = gfsPointCached(lat, lon, validUtc);
      if (pt && pt.levels) {
        var lv = interpLevel(pt.levels, levMb);
        if (lv) return { u: lv.u, v: lv.v, t: lv.t };
      }
    }
    return null;
  }

  function uvToSpeedDir(u, v) {
    var speedMs = Math.sqrt(u * u + v * v);
    var speedKt = speedMs * MS_TO_KT;
    var dirDeg = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
    return { speedKt: speedKt, dirDeg: dirDeg };
  }

  function makeBarb(speedKt, dirDeg, color) {
    var col = color || '#ffffff';
    var spd = Math.round(speedKt);
    if (spd < 5) {
      return '<circle cx="0" cy="0" r="5" fill="none" stroke="' + col + '" stroke-width="1.5"/>';
    }
    var parts = [];
    parts.push('<line x1="0" y1="0" x2="' + STAFF_LEN + '" y2="0" stroke="' + col + '" stroke-width="1.5" stroke-linecap="round"/>');
    var rem5 = Math.round(spd / 5) * 5;
    var flags = Math.floor(rem5 / 50);
    rem5 -= flags * 50;
    var longs = Math.floor(rem5 / 10);
    rem5 -= longs * 10;
    var shorts = Math.floor(rem5 / 5);
    var pos = STAFF_LEN;
    var i;
    for (i = 0; i < flags; i++) {
      pos -= 5;
      var x0 = pos;
      parts.push('<polygon points="' + x0 + ',0 ' + (x0 + 5) + ',-4 ' + (x0 + 5) + ',4" fill="' + col + '" stroke="none"/>');
      pos -= 3;
    }
    for (i = 0; i < longs; i++) {
      pos -= 4;
      parts.push('<line x1="' + pos + '" y1="0" x2="' + pos + '" y2="' + (-PEN_LEN) + '" stroke="' + col + '" stroke-width="1.5" stroke-linecap="round"/>');
      pos -= 2;
    }
    for (i = 0; i < shorts; i++) {
      pos -= 4;
      parts.push('<line x1="' + pos + '" y1="0" x2="' + pos + '" y2="' + (-SHORT_PEN) + '" stroke="' + col + '" stroke-width="1.5" stroke-linecap="round"/>');
      pos -= 2;
    }
    var blowTo = (dirDeg + 180) % 360;
    var rotDeg = blowTo - 90;
    return '<g transform="rotate(' + rotDeg + ')">' + parts.join('') + '</g>';
  }

  function makeBarbIconHtml(speedKt, dirDeg, tempC, color) {
    var col = color || '#ffffff';
    var barbSvg = makeBarb(speedKt, dirDeg, col);
    var tempStr = (tempC !== null && !isNaN(tempC)) ? Math.round(tempC) + '\u00B0' : '';
    return '<div style="position:relative;width:60px;height:60px;pointer-events:none;">' +
      '<svg width="60" height="60" viewBox="-30 -30 60 60" style="overflow:visible;">' +
      barbSvg +
      '</svg>' +
      (tempStr ? '<span style="position:absolute;left:34px;top:34px;font-size:10px;color:' + col +
        ';font-family:monospace;line-height:1;text-shadow:0 0 2px #000,0 0 3px #000;">' + tempStr + '</span>' : '') +
      '</div>';
  }

  function windLegendSampleSvg(color) {
    var col = color || '#ffffff';
    return '<svg width="72" height="52" viewBox="-8 -26 72 52" style="vertical-align:middle;">' +
      makeBarb(50, 270, col) +
      '<g transform="translate(28,0)">' + makeBarb(10, 270, col) + '</g>' +
      '<g transform="translate(48,0)">' + makeBarb(5, 270, col) + '</g>' +
      '</svg>';
  }

  function fetchPointThenSample(lat, lon, levMb, validUtc, done) {
    if (typeof gfsPointAt !== 'function') {
      done(null);
      return;
    }
    gfsPointAt(lat, lon, validUtc, function(err) {
      if (err) {
        done(null);
        return;
      }
      done(windSampleAt(lat, lon, levMb, validUtc));
    });
  }

  function render(map, opts) {
    if (!map || !opts) return null;
    var gridPoints = opts.gridPoints || [];
    var fl = opts.fl || 350;
    var validUtc = opts.validUtc;
    var color = opts.color || '#ffffff';
    var levMb = windFlToMb(fl);
    var group = L.layerGroup();
    var pending = [];
    var gi;

    if (!(validUtc instanceof Date) || isNaN(validUtc.getTime())) {
      validUtc = new Date();
    }

    for (gi = 0; gi < gridPoints.length; gi++) {
      (function(pt) {
        var sample = windSampleAt(pt.lat, pt.lon, levMb, validUtc);
        if (sample) {
          var uv = uvToSpeedDir(sample.u, sample.v);
          var tempC = sample.t - 273.15;
          var html = makeBarbIconHtml(uv.speedKt, uv.dirDeg, tempC, color);
          var ic = L.divIcon({
            html: html,
            className: 'gfs-wind-barb-icon',
            iconSize: [60, 60],
            iconAnchor: [30, 30]
          });
          var mk = L.marker([pt.lat, pt.lon], { icon: ic, interactive: false });
          group.addLayer(mk);
        } else {
          pending.push(pt);
        }
      })(gridPoints[gi]);
    }

    group.addTo(map);

    if (pending.length && typeof gfsPointAt === 'function') {
      var concurrency = 6;
      var idx = 0;
      var inFlight = 0;

      function pump() {
        while (inFlight < concurrency && idx < pending.length) {
          (function(p) {
            inFlight++;
            fetchPointThenSample(p.lat, p.lon, levMb, validUtc, function(sample) {
              inFlight--;
              if (sample && group._map) {
                var uv2 = uvToSpeedDir(sample.u, sample.v);
                var tempC2 = sample.t - 273.15;
                var html2 = makeBarbIconHtml(uv2.speedKt, uv2.dirDeg, tempC2, color);
                var ic2 = L.divIcon({
                  html: html2,
                  className: 'gfs-wind-barb-icon',
                  iconSize: [60, 60],
                  iconAnchor: [30, 30]
                });
                var mk2 = L.marker([p.lat, p.lon], { icon: ic2, interactive: false });
                group.addLayer(mk2);
              }
              if (idx >= pending.length && inFlight === 0) return;
              pump();
            });
          })(pending[idx]);
          idx++;
        }
      }
      pump();
    }

    return group;
  }

  window.GfsWind = {
    render: render,
    makeBarb: makeBarb,
    makeBarbIconHtml: makeBarbIconHtml,
    windLegendSampleSvg: windLegendSampleSvg,
    windFlToMb: windFlToMb,
    windSampleAt: windSampleAt,
    uvToSpeedDir: uvToSpeedDir
  };
})();
