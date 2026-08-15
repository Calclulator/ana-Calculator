# Cursor指示書: METAR取得ソースをaviationweather.govに変更 (index.html)

ES5制約厳守 (var / function宣言 / 文字列連結 / アロー関数禁止)。

---

## 問題の真因

`loadMetarsForIcaosList` は CheckWX をプライマリとして呼び出している。
CheckWX がレート制限やエラーで **一部のICAOだけ** を返すと、
`merged.length > 0` になりフォールバック条件に引っかからない。
その結果、対象ICAOの一部が欠落し "データなし" プレースホルダーが残る。

aviationweather.gov は:
- 認証キー不要
- レート制限なし
- CORS プリフライト不要（単純GETリクエスト）
- 国際空港(ICAO 4文字)をほぼ全域カバー

---

## 変更箇所: `loadMetarsForIcaosList` 関数を置き換える

### 探す（現在のコード）

```javascript
function loadMetarsForIcaosList(near, skipTaf) {
  if(!near || !near.length) return Promise.resolve();
  var headers = AP_CHECKWX_HEADERS;

  var chunks = apChunkIcaos(near, 25);
  console.log('[A/P-fetch] METAR-batches', chunks.length);
  var reqs = chunks.map(function(chunk, idx) {
    var metarUrl = 'https://api.checkwx.com/v2/metar/' + chunk.join(',') + '/decoded';
    return apFetchCheckwxJson(metarUrl, headers, 'METAR-batch-' + (idx + 1))
      .then(function(res) { return { ok: true, res: res, idx: idx }; })
      .catch(function(err) { return { ok: false, err: err, idx: idx }; });
  });
  return Promise.all(reqs).then(function(results) {
    var merged = [];
    var i;
    for(i = 0; i < results.length; i++) {
      if(!results[i].ok) {
        console.warn('[A/P-fetch] METAR batch failed idx=' + results[i].idx, results[i].err);
        continue;
      }
      var d = results[i].res && results[i].res.json ? results[i].res.json : null;
      if(d && d.data && d.data.length) merged = merged.concat(d.data);
    }
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
  }).catch(function(err) {
    console.error('[A/P-fetch] loadMetars failed name=', err && err.name, 'message=', err && err.message, 'stack=', err && err.stack);
    renderMetarMarkers([], headers);
  });
}
```

### 置き換え（修正後のコード）

```javascript
function loadMetarsForIcaosList(near, skipTaf) {
  if(!near || !near.length) return Promise.resolve();
  var headers = AP_CHECKWX_HEADERS;

  console.log('[A/P-fetch] METAR: trying aviationweather.gov (primary)', near.length, 'airports');

  // ── プライマリ: aviationweather.gov (認証不要・レート制限なし) ──
  return apFetchAvwxMetar(near).then(function(avwxMerged) {
    if(avwxMerged && avwxMerged.length) {
      console.log('[A/P-fetch] aviationweather.gov OK:', avwxMerged.length, 'METARs');
      avwxMerged.forEach(function(row) {
        if(row && row.icao) {
          ensureApWxCache();
          window.__apWxCache.metarByIcao[String(row.icao).toUpperCase()] = row;
        }
      });
      renderMetarMarkers(avwxMerged, headers);
      return;
    }

    // ── セカンダリ: CheckWX (aviationweather.govが空の場合のみ) ──
    console.warn('[A/P-fetch] aviationweather.gov returned empty — falling back to CheckWX');
    var chunks = apChunkIcaos(near, 25);
    var reqs = chunks.map(function(chunk, idx) {
      var metarUrl = 'https://api.checkwx.com/v2/metar/' + chunk.join(',') + '/decoded';
      return apFetchCheckwxJson(metarUrl, headers, 'METAR-batch-' + (idx + 1))
        .then(function(res) { return { ok: true, res: res, idx: idx }; })
        .catch(function(err) { return { ok: false, err: err, idx: idx }; });
    });
    return Promise.all(reqs).then(function(results) {
      var merged = [];
      var i;
      for(i = 0; i < results.length; i++) {
        if(!results[i].ok) {
          console.warn('[A/P-fetch] METAR batch failed idx=' + results[i].idx, results[i].err);
          continue;
        }
        var d = results[i].res && results[i].res.json ? results[i].res.json : null;
        if(d && d.data && d.data.length) merged = merged.concat(d.data);
      }
      merged.forEach(function(row) {
        if(row && row.icao) {
          ensureApWxCache();
          window.__apWxCache.metarByIcao[String(row.icao).toUpperCase()] = row;
        }
      });
      renderMetarMarkers(merged, headers);
    });
  }).catch(function(err) {
    console.error('[A/P-fetch] loadMetars failed', err && err.message);
    renderMetarMarkers([], headers);
  });
}
```

---

## 効果

| 状況 | 修正前 | 修正後 |
|------|--------|--------|
| CheckWX が一部のみ返す | フォールバック未発動 → 欠落空港が "データなし" | aviationweather.gov が全空港を一括返却 |
| CheckWX がレート制限 | 同上 | 同上 |
| aviationweather.gov が空 | 呼ばれない | CheckWX にフォールバック |
| 両方失敗 | プレースホルダー残存 | プレースホルダー表示（変化なし） |

---

## コミット手順

```
git add index.html
git commit -m "fix: METAR取得をaviationweather.gov優先・CheckWXをセカンダリに変更"
git push origin main
```
