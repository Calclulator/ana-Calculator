# Cursor指示書: WX Radar WP/A/P表示修正 + ATO反映ボタン (index.html)

ES5制約厳守 (var / function宣言 / 文字列連結 / アロー関数禁止 / async/await禁止)。
修正A → B → C の順に適用してコミット。

---

## 修正A: Waypoint ラベルを常時表示に変更

### 問題の真因

`drawRoute()` 内で非キーWP (w.t が falsy かつ KEY_WP に含まれない) は
`permanent: false` の tooltip を bindTooltip している。
iPad では hover がないため、tap しない限りラベルが表示されない。

### 変更箇所: `drawRoute` 内の WP tooltip 分岐を置き換える

以下を探す:

```javascript
      if(w.t || KEY_WP[w.id]) {
        m.bindTooltip('<span style="font-size:'+WP_FONT_SIZE+'px">'+w.id+'</span>',{permanent:true, direction:'top', className:'wxt', offset:[0,-4]});
      } else {
        m.bindTooltip(w.id,{permanent:false, direction:'top', className:'wxt-wp', offset:[0,-4]});
      }
```

以下に置き換える（全WPを permanent:true に統一、キー以外は小さめフォント）:

```javascript
      if(w.t || KEY_WP[w.id]) {
        m.bindTooltip('<span style="font-size:'+WP_FONT_SIZE+'px">'+w.id+'</span>',{permanent:true, direction:'top', className:'wxt', offset:[0,-4]});
      } else {
        m.bindTooltip('<span style="font-size:9px;opacity:.75">'+w.id+'</span>',{permanent:true, direction:'top', className:'wxt-wp', offset:[0,-3]});
      }
```

**効果**: 全WPのラベルがタップ不要で常時表示される。
キーWPは従来サイズ (`WP_FONT_SIZE`)、非キーWPは9px・75%透明度で区別。

---

## 修正B: A/P METAR — aviationweather.gov をフォールバックに追加

### 問題の真因

CheckWX API (`api.checkwx.com`) がレート制限またはネットワーク障害で空データを返すと、
`renderRaltPlaceholderMarkers()` が表示した灰色サークルが永続する。
METAR更新ボタンを押しても同じAPIを再度叩くため改善しない。

### 変更箇所1: `loadMetarsForIcaosList` の末尾に avwx フォールバックを追加

以下を探す（`loadMetarsForIcaosList` 内の Promise.all 処理の末尾）:

```javascript
    if(!merged.length) {
      console.warn('[A/P-fetch] METAR all batches empty or failed');
    }
    merged.forEach(function(row) {
      if(row && row.icao) {
        ensureApWxCache();
        window.__apWxCache.metarByIcao[String(row.icao).toUpperCase()] = row;
      }
    });
    renderMetarMarkers(merged, headers);
```

以下に置き換える:

```javascript
    if(!merged.length) {
      console.warn('[A/P-fetch] METAR all batches empty or failed — trying avwx fallback');
      // ── フォールバック: aviationweather.gov (認証不要) ──
      apFetchAvwxMetar(near).then(function(avwxMerged) {
        avwxMerged.forEach(function(row) {
          if(row && row.icao) {
            ensureApWxCache();
            window.__apWxCache.metarByIcao[String(row.icao).toUpperCase()] = row;
          }
        });
        renderMetarMarkers(avwxMerged, headers);
      }).catch(function(e) {
        console.warn('[A/P-fetch] avwx fallback also failed', e);
        renderMetarMarkers([], headers);
      });
      return;
    }
    merged.forEach(function(row) {
      if(row && row.icao) {
        ensureApWxCache();
        window.__apWxCache.metarByIcao[String(row.icao).toUpperCase()] = row;
      }
    });
    renderMetarMarkers(merged, headers);
```

### 変更箇所2: `apFetchCheckwxJson` 関数の直後に `apFetchAvwxMetar` を追加

`apFetchCheckwxJson` 関数の閉じ括弧 `}` の直後に以下を追加:

```javascript
// aviationweather.gov METAR フォールバック
// CheckWX が空の場合に呼ばれる。ICAOリストを25件ごとに分割してフェッチ。
// 戻り値: CheckWX互換形式 {icao, flight_category, raw_text, ...} の配列を resolve する Promise
function apFetchAvwxMetar(icaos) {
  if(!icaos || !icaos.length) return Promise.resolve([]);
  var chunks = apChunkIcaos(icaos, 25);
  var reqs = chunks.map(function(chunk) {
    var url = 'https://aviationweather.gov/api/data/metar?ids=' + chunk.join(',') + '&format=json&hours=2';
    return fetch(url)
      .then(function(r) { return r.ok ? r.json() : []; })
      .catch(function() { return []; });
  });
  return Promise.all(reqs).then(function(results) {
    var merged = [];
    var i;
    for(i = 0; i < results.length; i++) {
      if(Array.isArray(results[i])) merged = merged.concat(results[i]);
    }
    // aviationweather.gov の JSON を CheckWX 互換形式に変換
    return merged.map(function(row) {
      if(!row || !row.icaoId) return null;
      var cat = row.flightCategory || '';
      // flight_category マッピング
      var fcMap = { VFR: 'VFR', MVFR: 'MVFR', IFR: 'IFR', LIFR: 'LIFR' };
      return {
        icao: String(row.icaoId).toUpperCase(),
        raw_text: row.rawOb || '',
        flight_category: fcMap[cat] || cat,
        temperature: { celsius: (typeof row.temp === 'number' ? row.temp : null) },
        dewpoint:    { celsius: (typeof row.dewp === 'number' ? row.dewp : null) },
        wind: {
          speed_kts:   (typeof row.wspd === 'number' ? row.wspd : null),
          degrees:     (typeof row.wdir === 'number' ? row.wdir : null),
          gust_kts:    (typeof row.wgst === 'number' ? row.wgst : null)
        },
        visibility: { miles: (typeof row.visib === 'string' ? parseFloat(row.visib) : null) },
        ceiling: (row.clouds && row.clouds.length ? (function() {
          var c;
          for(var ci = 0; ci < row.clouds.length; ci++) {
            c = row.clouds[ci];
            if(c.cover === 'BKN' || c.cover === 'OVC') {
              return { feet_agl: (typeof c.base === 'number' ? c.base * 100 : null), code: c.cover };
            }
          }
          return null;
        })() : null),
        clouds: (row.clouds || []).map(function(c) {
          return { code: c.cover || '', base_feet_agl: (typeof c.base === 'number' ? c.base * 100 : null) };
        }),
        observed: row.reportTime || '',
        station: { geometry: (row.lat && row.lon ? { coordinates: [row.lon, row.lat] } : null) }
      };
    }).filter(function(r) { return r !== null; });
  });
}
```

**効果**:
- CheckWX が空データを返した場合、aviationweather.gov にフォールバック
- aviationweather.gov は認証不要で CORS 対応
- CheckWX が成功した場合はフォールバックは呼ばれない（変化なし）

---

## 修正C: ATO反映ボタン追加 + バックグラウンド復帰時に自動反映

### 問題の真因

`setInterval(tickAtoAutoFill, 30000)` は iOS/iPadOS でバックグラウンド状態になると
JavaScript タイマーが停止し、アプリ切り替え後に次のチック（最大30秒後）まで更新されない。
また `document.visibilitychange` イベントが未対応のため、
フォアグラウンドへの復帰を検知できない。

### 変更箇所1: ATO 列ヘッダーに「ATO反映」ボタンを追加

以下を探す:

```html
          <th>ATO</th>
```

以下に置き換える:

```html
          <th>ATO <button onclick="tickAtoAutoFill();if(typeof renderFpTable==='function')renderFpTable();" style="font-size:9px;padding:1px 5px;margin-left:3px;background:#1a3a4a;color:#4fc3f7;border:1px solid #4fc3f7;border-radius:3px;cursor:pointer;vertical-align:middle;" title="現在時刻に基づいてATOを自動入力">反映</button></th>
```

### 変更箇所2: `startAtoAutoFill` 関数に `visibilitychange` リスナーを追加

以下を探す:

```javascript
function startAtoAutoFill() {
  if(ATO_AUTO_INT) { clearInterval(ATO_AUTO_INT); ATO_AUTO_INT = null; }
  if(typeof FP_ROWS === 'undefined' || !FP_ROWS || FP_ROWS.length < 2) return;
  ATO_AUTO_INT = setInterval(tickAtoAutoFill, 30000);
  tickAtoAutoFill();
}
```

以下に置き換える:

```javascript
function startAtoAutoFill() {
  if(ATO_AUTO_INT) { clearInterval(ATO_AUTO_INT); ATO_AUTO_INT = null; }
  if(typeof FP_ROWS === 'undefined' || !FP_ROWS || FP_ROWS.length < 2) return;
  ATO_AUTO_INT = setInterval(tickAtoAutoFill, 30000);
  tickAtoAutoFill();
  // バックグラウンドから復帰した瞬間にATOを反映する
  if(!window._atoVisibilityListenerAdded) {
    window._atoVisibilityListenerAdded = true;
    document.addEventListener('visibilitychange', function() {
      if(document.visibilityState === 'visible') {
        if(typeof FP_ROWS !== 'undefined' && FP_ROWS && FP_ROWS.length >= 2) {
          tickAtoAutoFill();
          if(typeof renderFpTable === 'function') renderFpTable();
        }
      }
    });
  }
}
```

**効果**:
- 「反映」ボタンをタップすれば即座に現在UTC基準でATO更新
- バックグラウンドからアプリを復帰した瞬間に自動でATO更新（タイマー待ち不要）
- `_atoVisibilityListenerAdded` フラグで重複登録を防止

---

## コミット手順

```
git add index.html
git commit -m "fix: WP全件permanent tooltip / avwx METAR fallback / ATO反映ボタン+visibilitychange"
git push origin main
```
