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
    gfsRadarNeighborPt: gfsRadarNeighborPt
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    gfsRadarNeighborPt: gfsRadarNeighborPt,
    normalizePoint: normalizePoint,
    normalizeLon: normalizeLon
  };
}
