# 修正指示書: OFP SKEW-T 精度向上 + APCH Preparation 改訂

**ES5 厳守 (var / function のみ)。既存の FLT PLN・NAVLOG・NOTAM ロジックは変更しないこと。**

---

## 修正 1: OFP SKEW-T を WX 同等精度に

### 対象: `wxOfpOpenMeteoUrl` 関数

現行: 10 気圧面・`relative_humidity_` のみ・モデル指定なし  
修正: 12 気圧面・`dewpoint_` + `geopotential_height_` 追加・`gfs_seamless` 指定

```javascript
// 既存の wxOfpOpenMeteoUrl を以下に完全置き換え
function wxOfpOpenMeteoUrl(lat, lon, hourIso) {
  var vars = [];
  var i;
  var levels = [1000, 925, 850, 700, 600, 500, 400, 300, 250, 200, 150, 100];
  for(i = 0; i < levels.length; i++) {
    vars.push('temperature_'        + levels[i] + 'hPa');
    vars.push('dewpoint_'           + levels[i] + 'hPa');
    vars.push('relative_humidity_'  + levels[i] + 'hPa');
    vars.push('windspeed_'          + levels[i] + 'hPa');
    vars.push('winddirection_'      + levels[i] + 'hPa');
    vars.push('geopotential_height_'+ levels[i] + 'hPa');
  }
  return 'https://api.open-meteo.com/v1/forecast'
    + '?latitude='  + lat.toFixed(4)
    + '&longitude=' + lon.toFixed(4)
    + '&hourly='    + vars.join(',')
    + '&models=gfs_seamless&forecast_days=2&timezone=UTC';
}
```

**注意:** `hourIso` は呼び出し元で既に `wxOfpParseOpenMeteo(json, hourIso)` に渡しているため、
URL 内の `start_date`/`end_date` を削除してもパーサー側のベストマッチ処理が機能する。

---

## 修正 2: APCH Preparation — METAR/TAF 欄に ATIS を追加

### 対象: `renderMetarTafText` 関数（約 11106 行）

各タブの METAR/TAF 取得完了後に ATIS セクションを追加する。

```javascript
// ── 変更箇所: renderMetarTafText 内の Promise.all().then() ブロック ──
// 現行の bodyEl.innerHTML = ... の直後（Promise.all の .then 内末尾）に以下を追加:

// ATIS セクション追加
var atisWrapId = 'apch-atis-wrap-' + t.icao + '-' + bodyIdx;
var existingAtis = document.getElementById(atisWrapId);
if(!existingAtis) {
  var atisWrap = document.createElement('div');
  atisWrap.id = atisWrapId;
  atisWrap.style.marginTop = '12px';
  var atisHdr = document.createElement('div');
  atisHdr.style.cssText = 'font-size:11px;font-weight:bold;color:' + C.acc + ';' +
    'border-bottom:1px solid ' + C.bdr + ';padding-bottom:2px;margin-bottom:4px;';
  atisHdr.textContent = '▍ATIS ' + t.icao;
  atisWrap.appendChild(atisHdr);
  var atisBox = document.createElement('div');
  var atisBoxId = 'apch-atis-box-' + t.icao + '-' + bodyIdx;
  atisBox.id = atisBoxId;
  atisWrap.appendChild(atisBox);
  bodyEl.appendChild(atisWrap);
  if(typeof wxFetchAtis === 'function') {
    wxFetchAtis(t.icao, atisBoxId);
  }
}
```

**配置箇所の目印:**

```javascript
// ▼ 変更前 (Promise.all の .then 内)
}).then(function(results) {
  var metarRaw = results[0] || '(METAR unavailable)';
  var tafFmt = formatApchTafRaw(results[1]);
  var esc = ...;
  bodyEl.innerHTML = ...;   // ← この行の直後に上記コードを挿入
}).catch(...);
```

---

## 修正 3: APCH Preparation — TAF テキストを Day mode で濃色表示

### 対象: `renderMetarTafText` 内 bodyEl.innerHTML 生成部分（約 11170 行）

現行の TAF 色指定（ハードコード）を `getDayColors()` の値に変更する。

```javascript
// 変更前:
'<div style="color:#81c784;font-weight:bold;margin-bottom:3px;">▍TAF ' + esc(t.icao) + '</div>' +
'<div style="white-space:pre-wrap;color:#d0f0d0;">' + esc(tafFmt) + '</div>';

// 変更後:
'<div style="color:#4caf50;font-weight:bold;margin-bottom:3px;">▍TAF ' + esc(t.icao) + '</div>' +
'<div style="white-space:pre-wrap;color:' + C.text + ';">' + esc(tafFmt) + '</div>';
```

`C.text` は Day mode で `#1a2a3a`（濃紺黒）、Night mode で `#cfd8dc`（白寄り）。
`#4caf50`（ミディアムグリーン）は両モードで視認できる濃さ。

---

## 修正 4: APCH Preparation — 断面図は既実装のため変更不要

`drawCrossSection` は `NAV_WINDS_ALOFT` から読み込む実装が完了している。
注記テキストも "NavLog WINDS/TEMP ALOFT" と表示済み。コード変更不要。

---

## 修正 5: APCH Preparation — Skew-T を WX 同等の Canvas 描画に

### 対象: `generateSkewTFromOpenMeteo` 関数（約 10983 行）

現行: `fetchOpenMeteoSounding` → `renderSkewTSvg`（SVG 簡易描画）  
修正: 同データを `wxOfpDrawSkewt`（Canvas 高品質描画）に切り替える

```javascript
// 既存の generateSkewTFromOpenMeteo を以下に完全置き換え
function generateSkewTFromOpenMeteo(icao, etaDate, elOrId) {
  var el = (typeof elOrId === 'string') ? document.getElementById(elOrId) : elOrId;
  if(!el) return;
  var ic = String(icao || '').toUpperCase();
  var latlon = getSkewTLatLon(ic);
  if(!latlon) {
    apchSetError(el, 'Skew-T: ' + ic + ' 位置情報未登録（ICAO_TO_LATLONに追加してください）');
    return;
  }

  apchClearEl(el);
  var loading = document.createElement('div');
  loading.style.cssText = 'color:#aaa;font-size:11px;padding:8px;text-align:center;';
  loading.appendChild(document.createTextNode('Skew-T 生成中（Open-Meteo GFS）…'));
  el.appendChild(loading);

  // WX と同じ 12気圧面・dewpoint・geopotential_height を取得
  var LEVELS = [1000, 925, 850, 700, 600, 500, 400, 300, 250, 200, 150, 100];
  var vars = [];
  var li, lp;
  for(li = 0; li < LEVELS.length; li++) {
    lp = LEVELS[li];
    vars.push('temperature_'        + lp + 'hPa');
    vars.push('dewpoint_'           + lp + 'hPa');
    vars.push('relative_humidity_'  + lp + 'hPa');
    vars.push('windspeed_'          + lp + 'hPa');
    vars.push('winddirection_'      + lp + 'hPa');
    vars.push('geopotential_height_'+ lp + 'hPa');
  }

  var eta = (etaDate instanceof Date) ? new Date(etaDate.getTime()) : new Date(etaDate);
  if(isNaN(eta.getTime())) eta = new Date();
  var dateStr = eta.getUTCFullYear() + '-' + apchPad2(eta.getUTCMonth() + 1) + '-' + apchPad2(eta.getUTCDate());
  var hourIso  = dateStr + 'T' + apchPad2(eta.getUTCHours()) + ':00';
  var now      = new Date();
  var diffDays = (now.getTime() - eta.getTime()) / 86400000;
  var base     = (diffDays > 7)
    ? 'https://archive-api.open-meteo.com/v1/archive'
    : 'https://api.open-meteo.com/v1/forecast';
  var apiUrl = base
    + '?latitude='  + latlon[0].toFixed(4)
    + '&longitude=' + latlon[1].toFixed(4)
    + '&hourly='    + vars.join(',')
    + '&models=gfs_seamless&forecast_days=2&timezone=UTC';

  var xhr = new XMLHttpRequest();
  xhr.open('GET', apiUrl, true);
  xhr.responseType = 'text';
  xhr.onload = function() {
    var json, levels, label;
    if(xhr.status < 200 || xhr.status >= 300) {
      apchSetError(el, 'Skew-T: Open-Meteo HTTP ' + xhr.status);
      return;
    }
    try { json = JSON.parse(xhr.responseText); } catch(e) {
      apchSetError(el, 'Skew-T: JSON 解析エラー');
      return;
    }
    levels = wxOfpParseOpenMeteo(json, hourIso);
    if(!levels || !levels.length) {
      apchSetError(el, 'Skew-T: データなし (' + ic + ')');
      return;
    }
    label = ic + '  ' + dateStr + ' ' + apchPad2(eta.getUTCHours()) + 'UTC  GFS ※モデル';
    apchClearEl(el);
    // Canvas 高品質描画（WX と同一関数）
    wxOfpDrawSkewt(levels, label, function(dataUrl) {
      if(!dataUrl) { apchSetError(el, 'Skew-T: 描画失敗'); return; }
      apchClearEl(el);
      var hdr = document.createElement('div');
      hdr.style.cssText = 'font-size:10px;color:#9ca3af;padding:2px 6px;white-space:nowrap;overflow:hidden;';
      hdr.textContent = 'Skew-T  ' + label;
      el.appendChild(hdr);
      var img = document.createElement('img');
      img.src = dataUrl;
      img.style.cssText = 'width:100%;height:calc(100% - 18px);object-fit:contain;display:block;';
      el.appendChild(img);
    });
  };
  xhr.onerror = function() {
    apchSetError(el, 'Skew-T: 通信エラー');
  };
  xhr.send();
}
```

---

## 修正 6: APCH Preparation — 悪天予想図を国内のみ FBJP 表示

### 対象: `loadApchSigwx` 関数（約 10595 行）

現行: 海外は `loadFsas`（FSAS 表示）  
修正: 海外は表示しない

```javascript
// 既存の loadApchSigwx を以下に置き換え
function loadApchSigwx(destIcao, etaDate, cellEl) {
  if(!cellEl) return;
  if(isJapanAirport(destIcao)) {
    loadJmaSigwx(etaDate, cellEl);
  } else {
    apchClearEl(cellEl);
    var msg = document.createElement('div');
    msg.style.cssText = 'display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;height:100%;color:#78909c;font-size:11px;text-align:center;padding:8px;';
    msg.innerHTML = '<div style="font-size:20px;margin-bottom:6px;">🌐</div>' +
      '<div>海外就航空港</div>' +
      '<div style="font-size:10px;margin-top:3px;">悪天予想図は国内空港（RJ/RO）のみ表示</div>';
    cellEl.appendChild(msg);
  }
}
```

---

## まとめ（Cursor への指示）

```
fix_apch_ofp_v2.md の指示に従って index.html を修正してください。

【修正 1】wxOfpOpenMeteoUrl を置き換え
  - 12気圧面（100〜1000hPa）
  - dewpoint_ + geopotential_height_ + relative_humidity_ + temperature_ + windspeed_ + winddirection_ を追加
  - models=gfs_seamless&forecast_days=2&timezone=UTC に変更（start_date/end_date 削除）

【修正 2】renderMetarTafText の Promise.all().then() 内末尾に ATIS セクションを追加
  - atisWrap / atisBox 作成 → wxFetchAtis(t.icao, atisBoxId) 呼出

【修正 3】renderMetarTafText の TAF 表示部の色を変更
  - TAF ヘッダー: #81c784 → #4caf50
  - TAF ボディ: #d0f0d0 → C.text（getDayColors() の .text プロパティ）

【修正 4】断面図は変更不要（NAV_WINDS_ALOFT 実装済み）

【修正 5】generateSkewTFromOpenMeteo を置き換え
  - fetchOpenMeteoSounding + renderSkewTSvg → XHR + wxOfpParseOpenMeteo + wxOfpDrawSkewt（Canvas 版）
  - 12気圧面・dewpoint・geopotential_height・gfs_seamless 指定

【修正 6】loadApchSigwx を置き換え
  - isJapanAirport: FBJP 表示（変更なし）
  - 海外: loadFsas を呼ばず「海外就航空港 / 悪天予想図は国内のみ」メッセージを表示

ES5 厳守（var / function のみ）。他機能は変更しないこと。
```
