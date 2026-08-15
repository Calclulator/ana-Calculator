# Cursor指示書: A/P プレースホルダーのクリックをMETARキャッシュ参照に変更 (index.html)

ES5制約厳守 (var / function宣言 / 文字列連結 / アロー関数禁止)。

---

## 問題

色付きのMETAR円が表示されているのに、タップすると「METAR: データなし」が出る。
原因: タイミング競合で旧プレースホルダーマーカーが地図上に残っており、
METAR マーカーより上に描画されてタップを横取りしている。

## 修正方針

プレースホルダーマーカーのクリックハンドラーを書き換え:
1. `window.__apWxCache.metarByIcao[icao]` にキャッシュがあれば METAR ポップアップを表示
2. なければ aviationweather.gov に1件取得を試みる
3. それも失敗した場合のみ「データなし」を表示

---

## 変更箇所: `apDrawAirportMarker` 内のプレースホルダークリックハンドラー

### 探す（現在のコード）

```javascript
      mk.on('click', (function(icaoFix, llFix) {
        return function(e) {
          var ll = e && e.latlng ? e.latlng : llFix;
          var pop = L.popup({ maxWidth: 320, minWidth: 180 });
          pop.setLatLng(ll).setContent(apPopupNoMetarHtml(icaoFix)).openOn(map);
        };
      })(icao, llAp));
```

### 置き換え（修正後のコード）

```javascript
      mk.on('click', (function(icaoFix, llFix) {
        return function(e) {
          var ll = e && e.latlng ? e.latlng : llFix;
          var pop = L.popup({ maxWidth: 500, minWidth: 400 });
          // キャッシュに METAR データがあれば即表示
          ensureApWxCache();
          var cachedMetar = window.__apWxCache.metarByIcao[icaoFix];
          if(cachedMetar) {
            var cachedTaf = window.__apWxCache.tafByIcao[icaoFix];
            if(cachedTaf && cachedTaf.raw_text) {
              pop.setLatLng(ll).setContent(apPopupMetarTafHtml(cachedMetar, cachedTaf.raw_text)).openOn(map);
              return;
            }
            pop.setLatLng(ll).setContent(
              '<div class="wx-radar-popup-metar" style="font-family:monospace;font-size:13px;min-width:400px;max-width:400px;background:#fff;color:#1a1a1a;padding:10px;border-radius:4px;">' +
              '<div style="font-weight:bold;margin-bottom:8px;color:#1565c0;font-size:13px;">' + escH(icaoFix) + ' <span style="font-weight:normal;color:#546e7a;">' + escH(cachedMetar.flight_category || '') + '</span></div>' +
              '<div style="color:#546e7a;font-size:13px;">TAF 読込中...</div>' +
              '</div>'
            ).openOn(map);
            var tafUrl2 = 'https://api.checkwx.com/v2/taf/' + icaoFix + '/decoded';
            apFetchCheckwxJson(tafUrl2, AP_CHECKWX_HEADERS, 'TAF-ph-' + icaoFix)
              .then(function(tafRes) {
                var t2 = tafRes && tafRes.json ? tafRes.json : null;
                var tafObj2 = t2 && t2.data && t2.data[0] ? t2.data[0] : null;
                var tafRaw2 = tafObj2 && tafObj2.raw_text ? tafObj2.raw_text : '';
                if(tafObj2) {
                  ensureApWxCache();
                  window.__apWxCache.tafByIcao[icaoFix] = tafObj2;
                }
                pop.setContent(apPopupMetarTafHtml(cachedMetar, tafRaw2));
              })
              .catch(function() {
                pop.setContent(apPopupMetarTafHtml(cachedMetar, ''));
              });
            return;
          }
          // キャッシュなし → aviationweather.gov から1件取得
          pop.setLatLng(ll).setContent(
            '<div class="wx-radar-popup-metar" style="font-family:monospace;font-size:13px;min-width:300px;background:#fff;color:#1a1a1a;padding:10px;border-radius:4px;">' +
            '<div style="font-weight:bold;margin-bottom:8px;color:#1565c0;font-size:13px;">' + escH(icaoFix) + '</div>' +
            '<div style="color:#546e7a;font-size:13px;">METAR 読込中...</div>' +
            '</div>'
          ).openOn(map);
          var avwxUrl = 'https://aviationweather.gov/api/data/metar?ids=' + icaoFix + '&format=json&hours=2';
          fetch(avwxUrl)
            .then(function(r) { return r.ok ? r.json() : []; })
            .catch(function() { return []; })
            .then(function(rows) {
              if(!Array.isArray(rows) || !rows.length || !rows[0]) {
                pop.setContent(apPopupNoMetarHtml(icaoFix));
                return;
              }
              var row = rows[0];
              var cat = row.flightCategory || '';
              var fcMap = { VFR: 'VFR', MVFR: 'MVFR', IFR: 'IFR', LIFR: 'LIFR' };
              var m2 = {
                icao: String(row.icaoId || icaoFix).toUpperCase(),
                raw_text: row.rawOb || '',
                flight_category: fcMap[cat] || cat,
                temperature: { celsius: row.temp },
                dewpoint: { celsius: row.dewp },
                wind: { speed_kts: row.wspd, degrees: row.wdir, gust_kts: row.wgst },
                visibility: { miles: parseFloat(row.visib) || null },
                station: { geometry: (row.lat && row.lon ? { coordinates: [row.lon, row.lat] } : null) }
              };
              ensureApWxCache();
              window.__apWxCache.metarByIcao[icaoFix] = m2;
              pop.setContent(apPopupMetarTafHtml(m2, ''));
            });
        };
      })(icao, llAp));
```

---

## 効果

- プレースホルダーマーカーがタップされても、キャッシュにMETARデータがあれば正しく表示
- キャッシュがなくても aviationweather.gov に1件取得を試みる
- 両方失敗した場合のみ「データなし」
- 根本的なタイミング競合の影響を受けなくなる

---

## コミット手順

```
git add index.html
git commit -m "fix: プレースホルダータップ時もMETARキャッシュ参照・avwx fallback追加"
git push origin main
```
