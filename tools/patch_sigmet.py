# -*- coding: utf-8 -*-
import pathlib

p = pathlib.Path(__file__).resolve().parent.parent / 'index.html'
text = p.read_text(encoding='utf-8')
start = text.find('// =====================================================================\n// SIGMETs')
end = text.find('// =====================================================================\n// METAR', start)
if start < 0 or end < 0:
    raise SystemExit('markers not found')

new_block = """// =====================================================================
// SIGMETs
// =====================================================================
var SIGMET_GEOJSON_CACHE = null;

function fetchSigmetGeojsonBypassCache() {
  var url = 'https://sigmet.nomadic-tamuzo00.workers.dev/api/data/isigmet?format=geojson&_=' + Date.now();
  return fetch(url, { cache: 'no-store' })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      SIGMET_GEOJSON_CACHE = d;
      return d;
    });
}

function renderSigmetLayerFromCache() {
  if(LY.sig) { try { map.removeLayer(LY.sig); } catch(_eRm) {} LY.sig = null; }
  if(!document.getElementById('oSig').checked) return;
  var d = SIGMET_GEOJSON_CACHE;
  if(!d || !d.features || !d.features.length) return;
  function sigPopupEsc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  LY.sig = L.geoJSON(d, {
    style: function(f) {
      var h = (f.properties.hazard || '').toUpperCase();
      var c = h.indexOf('CONV') >= 0 ? '#ef5350' : h.indexOf('TURB') >= 0 ? '#ffa726' : h.indexOf('ICE') >= 0 ? '#ab47bc' : '#66bb6a';
      return { color: c, weight: 1.5, fillOpacity: 0.1, fillColor: c };
    },
    onEachFeature: function(f, l) {
      var props = f.properties || {};
      var hazard = (props.hazard || 'SIGMET').toUpperCase();
      var firLabel = props.firName || props.firId || props.icaoId || '';
      var title = hazard + (firLabel ? ' - ' + firLabel : '');
      var raw = props.rawAirSigmet || props.rawSigmet || '(本文なし)';
      var rawFmt = formatSigmetRawForDisplay(raw);
      var html = '<div style="font-family:monospace;font-size:13px;min-width:400px;max-width:400px;background:#fff;color:#1a1a1a;padding:5px;border-radius:4px;">'
        + '<motion style="font-weight:bold;margin-bottom:8px;color:#1565c0;font-size:13px;">' + sigPopupEsc(title) + '</div>'
        + '<pre style="white-space:pre-wrap;margin:0;color:#263238;font-size:13px;">' + sigPopupEsc(rawFmt) + '</pre>'
        + '</div>';
      l.bindPopup(html, { maxWidth: 500, minWidth: 420 });
      l.bindTooltip(sigPopupEsc(title), { className: 'sgx', sticky: true, direction: 'auto' });
    }
  }).addTo(map);
  bringTop();
}

function refreshSigmetsBypassCache() {
  return fetchSigmetGeojsonBypassCache()
    .then(function() { renderSigmetLayerFromCache(); })
    .catch(function() {});
}

function loadSigmets() {
  if(!document.getElementById('oSig').checked) return;
  if(SIGMET_GEOJSON_CACHE && SIGMET_GEOJSON_CACHE.features) {
    renderSigmetLayerFromCache();
    return;
  }
  refreshSigmetsBypassCache();
}

fetchSigmetGeojsonBypassCache().then(function() {
  renderSigmetLayerFromCache();
}).catch(function() {});

"""

new_block = new_block.replace(
    "+ '<motion style=\"font-weight:bold",
    "+ '<div style=\"font-weight:bold"
)

text = text[:start] + new_block + text[end:]
p.write_text(text, encoding='utf-8', newline='\n')
print('patched sigmet block')
