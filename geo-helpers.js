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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { gfsRadarNeighborPt: gfsRadarNeighborPt };
}
