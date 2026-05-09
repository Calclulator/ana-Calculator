// Pure VWS (kt per 1000 ft): sqrt((u2-u1)^2+(v2-v1)^2) / (dzFt/1000). u,v = kt components (east/north).
function computeVwsFromUv(u1, v1, u2, v2, dzFt) {
  if (typeof dzFt !== 'number' || dzFt <= 0 || isNaN(dzFt)) return NaN;
  var du = u2 - u1;
  var dv = v2 - v1;
  return Math.sqrt(du * du + dv * dv) / (dzFt / 1000);
}

if (typeof window !== 'undefined') {
  window.computeVwsFromUv = computeVwsFromUv;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeVwsFromUv: computeVwsFromUv };
}
