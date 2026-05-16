function floorUtcHour(date) {
  var d = date;
  if (!(d instanceof Date) || isNaN(d.getTime())) {
    d = new Date();
  }
  var y = d.getUTCFullYear();
  var mo = d.getUTCMonth();
  var da = d.getUTCDate();
  var h = d.getUTCHours();
  return new Date(Date.UTC(y, mo, da, h, 0, 0, 0));
}

function wpValidUtcHour(wp, fallbackDate) {
  if (wp && wp.etoUtc instanceof Date && !isNaN(wp.etoUtc.getTime())) {
    return floorUtcHour(wp.etoUtc);
  }
  var fb = fallbackDate;
  if (fb === null || fb === undefined || !(fb instanceof Date) || isNaN(fb.getTime())) {
    fb = new Date();
  }
  return floorUtcHour(fb);
}

function normalizeLon(lon) {
  if (typeof lon !== 'number' || isNaN(lon)) return lon;
  return ((lon + 540) % 360) - 180;
}

function normalizePoint(pt) {
  if (!pt) return null;
  var lon = (typeof pt.lon === 'number' && isFinite(pt.lon)) ? pt.lon
          : (typeof pt.lng === 'number' && isFinite(pt.lng)) ? pt.lng
          : (typeof pt.lngU === 'number' && isFinite(pt.lngU)) ? pt.lngU
          : null;
  if (typeof pt.lat !== 'number' || !isFinite(pt.lat) || lon === null) return null;
  lon = normalizeLon(lon);
  return { lat: pt.lat, lon: lon };
}

function gfsRadarNeighborPt(pt, dir, nm) {
  var lat = pt.lat;
  var lon = (typeof pt.lon === 'number') ? pt.lon : pt.lng;
  var dLat = nm / 60.0;
  var cosLat = Math.cos(lat * Math.PI / 180);
  if (Math.abs(cosLat) < 1e-6) cosLat = 1e-6;
  var dLon = (nm / 60.0) / cosLat;
  if (dir === 'N') return { lat: lat + dLat, lon: lon };
  if (dir === 'S') return { lat: lat - dLat, lon: lon };
  if (dir === 'E') return { lat: lat, lon: lon + dLon };
  return { lat: lat, lon: lon - dLon };
}

if (typeof window !== 'undefined') {
  window.GeoHelpers = {
    normalizeLon: normalizeLon,
    normalizePoint: normalizePoint,
    gfsRadarNeighborPt: gfsRadarNeighborPt,
    floorUtcHour: floorUtcHour,
    wpValidUtcHour: wpValidUtcHour
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    gfsRadarNeighborPt: gfsRadarNeighborPt,
    normalizePoint: normalizePoint,
    normalizeLon: normalizeLon,
    floorUtcHour: floorUtcHour,
    wpValidUtcHour: wpValidUtcHour
  };
}
