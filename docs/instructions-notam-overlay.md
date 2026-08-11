# Cursor指示書: NOTAM PDF オーバーレイ機能 (index.html)

ES5制約厳守 (var / function宣言 / 文字列連結 / アロー関数禁止)。
Step A→B→C→D→Eの順に適用してコミット。

---

## 背景・仕様

ANA の "ON PLAN / SUMMARY NOTAM" PDF をアップロードし、
エリア系 NOTAM（EXER ACT / DANGER AREA / WARNING EXER 等）に含まれる
座標列を解析してWX Radarのマップ上にポリゴン描画する。
タップで NOTAM 全文をポップアップ表示（SIGMET と同様）。

**対象座標フォーマット（E欄に直接記載）**
```
412500N1412945E       ← DDMMSS+N/S + DDDMMSS+E/W（整数秒）
023000.00N1051628.72E ← 小数秒付き
```
ポイント間は ` - ` で区切られ、3点以上でポリゴン、2点以下は円として描画。

---

## Step A: グローバル変数・LY.notam を追加

### A-1: グローバル変数定義の末尾（`var DUMP_TIME_MIN` 付近）に追加

```javascript
var NOTAM_DATA = [];   // パース済みエリア NOTAM の配列
```

### A-2: LY オブジェクトの初期化に `notam: []` を追加

以下を探す（LY の初期定義）:
```javascript
var LY = {
```
`pgum: []` または最後の項目の後に `, notam: []` を追加する。
（LY の定義が複数行にわたる場合、最後の `}` の直前に `, notam: []` を追加）

---

## Step B: FLT PLN パネルに NOTAM PDF アップロード UI を追加

### B-1: FLT PLN パネルの `parse-result` / `fpl-info` が並ぶ div を置き換え

以下を探す:
```html
    <div style="display:flex;align-items:center;gap:10px;">
      <span id="parse-result" style="color:#66bb6a;"></span>
      <span id="fpl-info" style="color:#4fc3f7;"></span>
    </div>
```

以下に置き換える:
```html
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <span id="parse-result" style="color:#66bb6a;"></span>
      <span id="fpl-info" style="color:#4fc3f7;"></span>
      <input type="file" id="notam-pdf-file" accept=".pdf" style="display:none;" onchange="loadNotamPdf(this)">
      <button class="btn" onclick="document.getElementById('notam-pdf-file').click()" style="font-size:11px;padding:2px 8px;">📋 NOTAM PDF</button>
      <span id="notam-status" style="color:#ffa726;font-size:0.9em;"></span>
    </div>
```

---

## Step C: WX Radar の OVERLAYS バーに NOTAM チェックボックスを追加

以下を探す:
```html
    <label class="ck"><input type="checkbox" id="oSig" checked onchange="loadSigmets()"> SIGMETs</label>
```

直後に追加（SIGMETs の次の行として）:
```html
    <label class="ck"><input type="checkbox" id="oNotam" onchange="toggleNotamLayer()"> NOTAM</label>
```

---

## Step D: NOTAM 関連の JavaScript 関数群を追加

`renderSigmetLayerFromCache` 関数の直前（SIGMET 関連コードの手前）に、
以下の関数群をまとめて追加する。

```javascript
// =====================================================================
// NOTAM PDF OVERLAY
// =====================================================================

// NOTAM座標文字列 (例: "412500N1412945E" / "023000.00N1051628.72E") をパース
function parseNotamCoord(coordStr) {
  var m = coordStr.match(
    /^(\d{2})(\d{2})(\d{2}(?:\.\d+)?)([NS])(\d{3})(\d{2})(\d{2}(?:\.\d+)?)([EW])$/
  );
  if(!m) return null;
  var lat = parseInt(m[1],10) + parseInt(m[2],10)/60 + parseFloat(m[3])/3600;
  var lon = parseInt(m[5],10) + parseInt(m[6],10)/60 + parseFloat(m[7])/3600;
  if(m[4]==='S') lat = -lat;
  if(m[8]==='W') lon = -lon;
  return [lat, lon];
}

// テキスト全体から座標列を含むエリア NOTAM を抽出
function parseNotamText(rawText) {
  NOTAM_DATA = [];
  // 検出用正規表現: DDMMSS[.ss]N + DDDMMSS[.ss]E が隣接する形式
  var detectRe = /\d{6}(?:\.\d+)?[NS]\d{7}(?:\.\d+)?[EW]/g;
  var all = [];
  var mm;
  while((mm = detectRe.exec(rawText)) !== null) {
    all.push({ idx: mm.index, raw: mm[0] });
  }
  if(!all.length) return;

  // 前後 200文字以内の座標を同一エリアとしてグループ化
  var groups = [];
  var cur = [all[0]];
  var i;
  for(i = 1; i < all.length; i++) {
    if(all[i].idx - all[i-1].idx < 300) {
      cur.push(all[i]);
    } else {
      if(cur.length >= 2) groups.push(cur.slice());
      cur = [all[i]];
    }
  }
  if(cur.length >= 2) groups.push(cur);

  var g, group, firstIdx, lastIdx, before, titleM, title, after, tilM, validity, fullText, coords, ci, ll;
  for(g = 0; g < groups.length; g++) {
    group = groups[g];
    firstIdx = group[0].idx;
    lastIdx  = group[group.length-1].idx + group[group.length-1].raw.length;

    // タイトル: 座標直前の最大 400文字から末尾のキーワード行を抽出
    before = rawText.substring(Math.max(0, firstIdx - 500), firstIdx);
    titleM = before.match(
      /((?:JASDF\s+)?(?:EXER\s+ACT|DANGER\s+AREA|WARNING[\s\-]+EXER|MISSILE[^\n]{0,40}LAUNCH|RESTRICTED\s+AREA|LASER[^\n]{0,30})[^\n]{0,80})\s*$/i
    );
    title = titleM ? titleM[1].replace(/\s+/g,' ').trim() : 'AREA NOTAM';

    // 有効期限: 座標後の 400文字から TIL-MM/DD または TIL-MM/DD を検索
    after = rawText.substring(lastIdx, lastIdx + 500);
    tilM  = after.match(/TIL[\-\s]*(\d{2}\/\d{2}(?:\s+\d{4})?)/);
    validity = tilM ? 'TIL ' + tilM[1] : '';

    // NOTAM全文 (前後 500文字)
    fullText = rawText.substring(Math.max(0, firstIdx - 500), lastIdx + 500).trim();

    // 座標変換
    coords = [];
    for(ci = 0; ci < group.length; ci++) {
      ll = parseNotamCoord(group[ci].raw);
      if(ll) coords.push(ll);
    }

    if(coords.length >= 2) {
      NOTAM_DATA.push({
        title:    title,
        validity: validity,
        fullText: fullText,
        coords:   coords
      });
    }
  }
}

// NOTAM レイヤーをマップに描画
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
  var color = '#ffa726';  // オレンジ（警告系）

  NOTAM_DATA.forEach(function(notam) {
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
    if(notam.coords.length >= 3) {
      layer = L.polygon(notam.coords, {
        color: color, weight: 2, fillOpacity: 0.12, fillColor: color, interactive: true
      });
    } else {
      layer = L.circle(notam.coords[0], {
        radius: 9260,  // 5NM
        color: color, weight: 2, fillOpacity: 0.12, fillColor: color, interactive: true
      });
    }
    layer.bindPopup(popHtml, { maxWidth: 560, minWidth: 400 });
    layer.bindTooltip(escN(notam.title), { className: 'sgx', sticky: true, direction: 'auto' });
    layer.addTo(map);
    LY.notam.push(layer);
  });

  if(typeof bringTop === 'function') bringTop();
}

// NOTAM チェックボックス onchange
function toggleNotamLayer() {
  var cb = document.getElementById('oNotam');
  if(!cb) return;
  if(cb.checked) {
    renderNotamLayer();
  } else {
    if(LY.notam) {
      LY.notam.forEach(function(l){ try{ map.removeLayer(l); }catch(e){} });
      LY.notam = [];
    }
  }
}

// NOTAM PDF アップロードハンドラ
function loadNotamPdf(input) {
  var file = input && input.files && input.files[0];
  if(!file) return;
  var statusEl = document.getElementById('notam-status');
  if(statusEl) statusEl.textContent = 'NOTAM 解析中...';

  var reader = new FileReader();
  reader.onload = function(e) {
    var typedArray = new Uint8Array(e.target.result);
    pdfjsLib.getDocument({ data: typedArray }).promise.then(function(pdf) {
      var promises = [];
      var pi;
      for(pi = 1; pi <= pdf.numPages; pi++) {
        (function(pageNum) {
          promises.push(
            pdf.getPage(pageNum).then(function(page) {
              return page.getTextContent().then(function(content) {
                // テキストアイテムを空白で結合（改行は保持しない）
                return content.items.map(function(item){ return item.str; }).join(' ');
              });
            })
          );
        })(pi);
      }
      return Promise.all(promises).then(function(pages) {
        var fullText = pages.join('\n');
        parseNotamText(fullText);
        if(statusEl) {
          statusEl.textContent = NOTAM_DATA.length
            ? NOTAM_DATA.length + ' area NOTAMs loaded'
            : '(エリア NOTAM なし)';
        }
        var cb = document.getElementById('oNotam');
        if(cb && cb.checked) renderNotamLayer();
      });
    }).catch(function(err) {
      if(statusEl) statusEl.textContent = 'NOTAM PDF 読み込みエラー';
    });
  };
  reader.readAsArrayBuffer(file);
}
```

---

## Step E: clearFpl() と bringTop() に NOTAM 処理を追加

### E-1: `clearFpl()` 関数の末尾（最後の `}` の直前）に追加

以下を探す（clearFpl 関数の末尾部分）:
```javascript
  if(typeof clearSatCache === 'function') clearSatCache();
```
の直前、または `clearFltPlnFromStorage()` 呼び出しの直後に、以下を追加:

```javascript
  // NOTAM クリア
  NOTAM_DATA = [];
  if(typeof LY !== 'undefined' && LY.notam) {
    LY.notam.forEach(function(l){ try{ map.removeLayer(l); }catch(e){} });
    LY.notam = [];
  }
  var notamInput = document.getElementById('notam-pdf-file');
  if(notamInput) notamInput.value = '';
  var notamStatus = document.getElementById('notam-status');
  if(notamStatus) notamStatus.textContent = '';
```

### E-2: `bringTop()` 関数内に NOTAM レイヤーの bringToFront を追加

`bringTop` 関数内の末尾（`LY.sig` の `bringToFront` の後）に追加:
```javascript
  if(LY.notam) LY.notam.forEach(function(l){ try{l.bringToFront();}catch(e){} });
```

---

## 動作確認ポイント

1. FLT PLN Load → ✓ 完了 の横に「📋 NOTAM PDF」ボタンが表示される
2. NOTAM PDF をアップロード → "X area NOTAMs loaded" と表示される
3. WX Radar → OVERLAYS → NOTAM チェックをON → マップにオレンジポリゴンが表示される
4. ポリゴンをタップ → NOTAM 全文ポップアップが表示される
5. ✕ Clear → NOTAM ポリゴンも消え、ステータスも空になる

---

## コミット手順

```
git add index.html
git commit -m "feat: NOTAM PDF overlay — area NOTAM polygon display on WX Radar map"
git push origin main
```
