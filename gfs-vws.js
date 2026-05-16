// Pure VWS [kt / 1000 ft]: sqrt((u2-u1)^2+(v2-v1)^2) / (dzFt/1000).
// u,v = kt (east/north). Callers must convert Open-Meteo m/s with * 1.94384.
// dzFt = vertical span in ft (e.g. +/-2000 ft -> 4000).
function computeVwsFromUv(u1, v1, u2, v2, dzFt) {
  if (typeof dzFt !== 'number' || dzFt <= 0 || isNaN(dzFt)) return NaN;
  var du = u2 - u1;
  var dv = v2 - v1;
  return Math.sqrt(du * du + dv * dv) / (dzFt / 1000);
}

// ── ANA WSCP VWS bands (kt / 1000 ft): shared by NAVLOG VWS / ATM(GFS) / WX Radar GFS overlay.
// Severe-first labels index 0..5 align with gfs-radar-layer bucket (0 = SEV).
var WSCP_VWS_SHEAR_SI_TO_KT_PER_KFT = 1.943844 * 0.3048 * 1000;
var WSCP_VWS_KT_LOWER_SEV_TO_SMT = [18, 13, 10, 7, 5];

var WSCP_VWS_LABELS_SEV_FIRST = [
  'SEV (18+)',
  'MOD (13-17)',
  'L+ (10-12)',
  'L (7-9)',
  'L- (5-6)',
  'SMT (0-4)'
];

function wscpVwsBuildSiThresholdsDesc() {
  var K = WSCP_VWS_SHEAR_SI_TO_KT_PER_KFT;
  var out = [];
  var i;
  for (i = 0; i < WSCP_VWS_KT_LOWER_SEV_TO_SMT.length; i++) {
    out.push(WSCP_VWS_KT_LOWER_SEV_TO_SMT[i] / K);
  }
  return out;
}

var WSCP_VWS_THRESHOLDS_SI = wscpVwsBuildSiThresholdsDesc();

// UI / ATM heat: bucket 0 = SMT (blue) … 5 = SEV (red), matches WS_UNIFIED_BG in index.html
function wscpVwsUiBucketFromKtPerKft(kt) {
  if (typeof kt !== 'number' || isNaN(kt)) return -1;
  if (kt <= 4) return 0;
  if (kt <= 6) return 1;
  if (kt <= 9) return 2;
  if (kt <= 12) return 3;
  if (kt <= 17) return 4;
  return 5;
}

function wscpVwsBandLabelFromKtPerKft(kt) {
  var b = wscpVwsUiBucketFromKtPerKft(kt);
  if (b < 0) return '';
  return WSCP_VWS_LABELS_SEV_FIRST[5 - b];
}

if (typeof window !== 'undefined') {
  window.computeVwsFromUv = computeVwsFromUv;
  window.WSCP_VWS_SHEAR_SI_TO_KT_PER_KFT = WSCP_VWS_SHEAR_SI_TO_KT_PER_KFT;
  window.WSCP_VWS_THRESHOLDS_SI = WSCP_VWS_THRESHOLDS_SI;
  window.WSCP_VWS_LABELS_GFS_ORDER = WSCP_VWS_LABELS_SEV_FIRST;
  window.wscpVwsUiBucketFromKtPerKft = wscpVwsUiBucketFromKtPerKft;
  window.wscpVwsBandLabelFromKtPerKft = wscpVwsBandLabelFromKtPerKft;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    computeVwsFromUv: computeVwsFromUv,
    WSCP_VWS_SHEAR_SI_TO_KT_PER_KFT: WSCP_VWS_SHEAR_SI_TO_KT_PER_KFT,
    WSCP_VWS_THRESHOLDS_SI: WSCP_VWS_THRESHOLDS_SI,
    WSCP_VWS_LABELS_SEV_FIRST: WSCP_VWS_LABELS_SEV_FIRST,
    WSCP_VWS_KT_LOWER_SEV_TO_SMT: WSCP_VWS_KT_LOWER_SEV_TO_SMT,
    wscpVwsUiBucketFromKtPerKft: wscpVwsUiBucketFromKtPerKft,
    wscpVwsBandLabelFromKtPerKft: wscpVwsBandLabelFromKtPerKft
  };
}
