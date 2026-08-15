# Cursor指示書: NOTAM 空域名称（R481等）の地図表示 (index.html)

ES5制約厳守 (var / function宣言 / 文字列連結 / アロー関数禁止)。
Step A → B → C → D の順に適用してコミット。

---

## 背景

"RICHMOND AIRSPACE R481 ACT" のように座標を持たず **空域識別符だけ** を参照する
NOTAM を OpenAIP API で境界取得してマップに描画する。
既存の座標ベースNOTAM描画（`NOTAM_DATA`）と統合する。

---

## Step A: グローバル変数を追加

`var NOTAM_DATA = [];` の直後に追加:

```javascript
var OPENAIP_API_KEY = 'YOUR_OPENAIP_API_KEY_HERE';  // openaip.net で取得したキーに置換
var NOTAM_AIRSPACE_CACHE = {};  // designator → OpenAIP GeoJSON キャッシュ
```

**注意**: `YOUR_OPENAIP_API_KEY_HERE` を実際のキーに手動で置換すること。

---

## Step B: ICAO→国コード変換ヘルパーを追加

`parseNotamCoord` 関数の直前に以下を追加:

```javascript
// ICAO 2文字プレフィックス → ISO 国コード (ANA 主要路線カバー)
function icaoPrefixToCountry(icao) {
  if(!icao || icao.length < 2) return '';
  var p2 = icao.substring(0, 2).toUpperCase();
  var p1 = icao.substring(0, 1).toUpperCase();
  var map2 = {
    'RJ':'JP','RO':'JP',
    'NZ':'NZ',
    'WS':'SG',
    'VM':'HK',
    'VT':'TH','VV':'VN','VY':'MM',
    'VI':'IN','VO':'IN','VE':'IN','VA':'IN',
    'ZB':'CN','ZG':'CN','ZH':'CN','ZJ':'CN','ZL':'CN',
    'ZP':'CN','ZS':'CN','ZT':'CN','ZU':'CN','ZW':'CN','ZY':'CN',
    'OE':'SA','OM':'AE','OI':'IR','OK':'KW','OB':'BH'
  };
  var map1 = { 'Y':'AU', 'K':'US', 'P':'US' };
  return map2[p2] || map1[p1] || '';
}

// テキスト中の ICAO 空港コードから国コードを推定
function guessCountryFromText(text) {
  // 4文字大文字のICAOコードを探す
  var icaoRe = /\b([A-Z]{4})\b/g;
  var m;
  while((m = icaoRe.exec(text)) !== null) {
    var c = icaoPrefixToCountry(m[1]);
    if(c) return c;
  }
  return '';
}
```

---

## Step C: `parseNotamText` に空域識別符の検出を追加

既存の `parseNotamText` 関数の末尾（`NOTAM_DATA.push(...)` の後の `}` の外、
関数の閉じ括弧の直前）に以下を追加:

```javascript
  // ── 空域識別符 (R481 ACT 等) の検出 ───────────────────────────────
  // 座標を含まないNOTAMで "R481 ACT" / "D203 ACTIVE" 等のパターンを検出する
  var airspaceRe = /\b([RDPCTW]\d{3,4}[A-Z]?)\s+(?:ACT(?:IVE)?|ACTVD)\b/g;
  var foundDesignators = {};
  var am;
  while((am = airspaceRe.exec(rawText)) !== null) {
    var desig = am[1];
    if(foundDesignators[desig]) continue;
    foundDesignators[desig] = true;

    // この識別符の前後 600文字を取り出してタイトル・有効期限・国コードを抽出
    var aStart = Math.max(0, am.index - 400);
    var aEnd   = Math.min(rawText.length, am.index + 600);
    var aText  = rawText.substring(aStart, aEnd);

    // 同じ識別符が座標グループとして既に NOTAM_DATA にある場合はスキップ
    var alreadyParsed = false;
    var ni;
    for(ni = 0; ni < NOTAM_DATA.length; ni++) {
      if(NOTAM_DATA[ni].designator === desig) { alreadyParsed = true; break; }
    }
    if(alreadyParsed) continue;

    // 有効期限
    var aTilM = aText.match(/TIL[\-\s]*(\d{2}\/\d{2}(?:[^\n]{0,30})?)/);
    var aValidity = aTilM ? 'TIL ' + aTilM[1].replace(/\s+/g,' ').trim() : '';

    // 国コード推定
    var aCountry = guessCountryFromText(aText);

    // タイトル: 識別符の直前の大文字フレーズ
    var beforeDesig = rawText.substring(Math.max(0, am.index - 100), am.index);
    var titlePhraseM = beforeDesig.match(/([A-Z][A-Z\s\/\-]{5,60})\s*$/);
    var aTitle = titlePhraseM
      ? titlePhraseM[1].replace(/\s+/g,' ').trim() + ' ' + desig
      : desig + ' ACT';

    // fullText: TIL行で終端
    var afterDesig = rawText.substring(am.index, am.index + 600);
    var endM2 = afterDesig.match(/TIL[\-\s]*\d{2}\/\d{2}[^\n]{0,60}?\([A-Z]{2,8}\)/);
    var aFullEnd = endM2 ? am.index + endM2.index + endM2[0].length : am.index + 400;
    var aFull = rawText.substring(Math.max(0, am.index - 200), aFullEnd).trim();

    NOTAM_DATA.push({
      title:    aTitle,
      validity: aValidity,
      fullText: aFull,
      coords:   null,         // 座標なし → OpenAIP から取得
      designator: desig,
      designatorCountry: aCountry,
      geoJson:  null          // fetchOpenAipAirspace() で非同期に埋める
    });
  }
```

---

## Step D: OpenAIP フェッチ関数と `renderNotamLayer` の更新

### D-1: `renderNotamLayer` 関数の直前に `fetchOpenAipAirspace` を追加

```javascript
// OpenAIP から空域識別符の GeoJSON ポリゴンを取得する
// 結果は NOTAM_AIRSPACE_CACHE[designator] にキャッシュ
function fetchOpenAipAirspace(designator, country, callback) {
  if(!OPENAIP_API_KEY || OPENAIP_API_KEY === 'YOUR_OPENAIP_API_KEY_HERE') {
    callback(null);
    return;
  }
  // キャッシュヒット
  if(NOTAM_AIRSPACE_CACHE[designator] !== undefined) {
    callback(NOTAM_AIRSPACE_CACHE[designator]);
    return;
  }
  var url = 'https://api.core.openaip.net/api/airspaces?designator='
    + encodeURIComponent(designator)
    + (country ? '&country=' + encodeURIComponent(country) : '')
    + '&limit=5'
    + '&apiKey=' + encodeURIComponent(OPENAIP_API_KEY);
  fetch(url)
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      var geo = null;
      if(data && data.items && data.items.length) {
        // 最初にマッチした空域の geometry を使用
        geo = data.items[0].geometry || null;
      }
      NOTAM_AIRSPACE_CACHE[designator] = geo;
      callback(geo);
    })
    .catch(function(e) {
      console.warn('[NOTAM-airspace] fetch failed for', designator, e);
      NOTAM_AIRSPACE_CACHE[designator] = null;
      callback(null);
    });
}
```

### D-2: `renderNotamLayer` 関数を置き換える

既存の `renderNotamLayer` 関数全体を以下に置き換える:

```javascript
// NOTAM レイヤーをマップに描画（座標ベース + OpenAIP 空域ベース）
function renderNotamLayer() {
  if(LY.notam) {
    LY.notam.forEach(function(l){ try{ map.removeLayer(l); }catch(e){} });
    LY.notam = [];
  }
  var cb = document.getElementById('oNotam');
  if(!cb || !cb.checked) return;
  if(!NOTAM_DATA || !NOTAM_DATA.length) return;
  if(typeof map === 'undefined' || !map) return;

  var escN = function(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
  var color = '#ffa726';

  function addLayerToMap(notam, geometry) {
    var popHtml =
      '<div style="font-family:monospace;font-size:12px;min-width:380px;max-width:520px;' +
      'background:#fff;color:#1a1a1a;padding:8px;border-radius:4px;">' +
        '<div style="font-weight:bold;margin-bottom:6px;color:#e65100;font-size:13px;">' +
          escN(notam.title) + '</div>' +
        (notam.validity ?
          '<div style="color:#888;font-size:11px;margin-bottom:6px;">' + escN(notam.validity) + '</div>' : '') +
        '<pre style="white-space:pre-wrap;margin:0;color:#263238;font-size:11px;">' +
          escN(notam.fullText) + '</pre>' +
      '</div>';

    var layer;
    if(geometry) {
      // OpenAIP GeoJSON ポリゴン
      layer = L.geoJSON(geometry, {
        style: function() {
          return { color: color, weight: 2, fillOpacity: 0.12, fillColor: color };
        }
      });
      layer.bindPopup(popHtml, { maxWidth: 560, minWidth: 400 });
      layer.bindTooltip(escN(notam.title), { className: 'sgx', sticky: true, direction: 'auto' });
    } else if(notam.coords && notam.coords.length >= 3) {
      // 座標ベースポリゴン
      layer = L.polygon(notam.coords, {
        color: color, weight: 2, fillOpacity: 0.12, fillColor: color, interactive: true
      });
      layer.bindPopup(popHtml, { maxWidth: 560, minWidth: 400 });
      layer.bindTooltip(escN(notam.title), { className: 'sgx', sticky: true, direction: 'auto' });
    } else if(notam.coords && notam.coords.length >= 1) {
      // 座標ベース円（2点以下）
      layer = L.circle(notam.coords[0], {
        radius: 9260, color: color, weight: 2, fillOpacity: 0.12, fillColor: color, interactive: true
      });
      layer.bindPopup(popHtml, { maxWidth: 560, minWidth: 400 });
      layer.bindTooltip(escN(notam.title), { className: 'sgx', sticky: true, direction: 'auto' });
    } else {
      return; // 座標もGeoJSONもない場合は描画しない
    }
    layer.addTo(map);
    LY.notam.push(layer);
    if(typeof bringTop === 'function') bringTop();
  }

  var i, notam;
  for(i = 0; i < NOTAM_DATA.length; i++) {
    notam = NOTAM_DATA[i];
    if(notam.designator && !notam.coords) {
      // OpenAIP から境界を取得して描画
      (function(n) {
        if(n.geoJson) {
          addLayerToMap(n, n.geoJson);
        } else {
          fetchOpenAipAirspace(n.designator, n.designatorCountry, function(geo) {
            n.geoJson = geo;
            if(geo) addLayerToMap(n, geo);
          });
        }
      })(notam);
    } else {
      // 座標ベース（即時描画）
      addLayerToMap(notam, null);
    }
  }
}
```

---

## 動作確認ポイント

1. `OPENAIP_API_KEY` を実際のキーに置換済みであること
2. NOTAM PDF を Upload → "R481 ACT" を含む NOTAM が検出されること
3. WX Radar → OVERLAYS → NOTAM チェック ON
4. "R481 ACT" に対応するオレンジポリゴンがシドニー近郊（リッチモンド空軍基地周辺）に表示されること
5. ポリゴンをタップ → NOTAM 全文ポップアップ

---

## コミット手順

```
git add index.html
git commit -m "feat: NOTAM R/D/P空域識別符をOpenAIP APIで境界取得してマップ表示"
git push origin main
```
