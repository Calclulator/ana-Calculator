# 指示書：2文字WPパース修正 & PGUM 250NMリング

対象ファイル: `index.html`
ES5厳守（var, function宣言, 文字列連結のみ）

---

## Step A: 2文字ウェイポイント（TL/PY等）のパース修正

**原因:** WP名を抽出するfallback正規表現が `{2,7}`（最低3文字）になっているため、
TL・PYのような2文字WPがfallbackで拾われない。

**修正箇所:** WPパースループ内の `nameM` 定義行（`var coordRe` より少し後、
`var nameM = seg.match(...)` の行）

**変更前:**
```javascript
    var nameM = seg.match(/^(-[A-Z]{3,6}|[A-Z][A-Z0-9\-]{1,7}|\d{2}[ENW]\d{2})/) || lineB.match(/(?:^|\s)(-[A-Z]{3,6}|[A-Z][A-Z0-9\-]{2,7}|\d{2}[ENW]\d{2})(?=\s|$)/);
```

**変更後（`{2,7}` → `{1,7}` の1箇所のみ）:**
```javascript
    var nameM = seg.match(/^(-[A-Z]{3,6}|[A-Z][A-Z0-9\-]{1,7}|\d{2}[ENW]\d{2})/) || lineB.match(/(?:^|\s)(-[A-Z]{3,6}|[A-Z][A-Z0-9\-]{1,7}|\d{2}[ENW]\d{2})(?=\s|$)/);
```

**確認:** TL・PY を含む NAVLOG を Apply して、該当WPが地図とテーブルに表示されること。

---

## Step B: PGUM 250NMリング（SYD便）

### B-1: LY オブジェクトに `pgum` 配列を追加

`var LY = {` の定義（`corridor:[], route:null, ...` の行）を修正:

**変更前:**
```javascript
var LY = {
  base:null, sat:null,
  corridor:[], route:null, wpts:[], etops:[], alt:[],
  routeBounds:null,
  fir:null, sig:null, metar:[], glide:null, ac:null, avoidL:null, avoidR:null
};
```

**変更後:**
```javascript
var LY = {
  base:null, sat:null,
  corridor:[], route:null, wpts:[], etops:[], alt:[],
  routeBounds:null,
  fir:null, sig:null, metar:[], glide:null, ac:null, avoidL:null, avoidR:null,
  pgum:[]
};
```

### B-2: `drawPgumRing()` 関数を追加

`drawEtops()` 関数の直後（`drawEtops();` の次の行の前）に挿入:

```javascript
function drawPgumRing() {
  LY.pgum.forEach(function(l){ try { map.removeLayer(l); } catch(e) {} });
  LY.pgum = [];
  var cb = document.getElementById('oPgum');
  if(!cb || !cb.checked) return;
  var pgumApt = APT['PGUM'];
  if(!pgumApt) return;
  var worldLngOffsets = [-360, 0, 360];
  for(var wi = 0; wi < worldLngOffsets.length; wi++) {
    var off = worldLngOffsets[wi];
    var c = L.circle([pgumApt.lat, pgumApt.lon + off], {
      radius: 250 * NM,
      color: 'rgba(79,195,247,0.7)',
      weight: 1.5,
      fill: false,
      dashArray: '6 4'
    }).addTo(map);
    c.bindTooltip('PGUM 250NM', { className: 'wxt', sticky: true });
    LY.pgum.push(c);
  }
  var ic = L.divIcon({
    html: '<span style="font-size:9px;color:rgba(79,195,247,.9);font-family:monospace;'
        + 'background:rgba(6,10,20,.85);padding:1px 4px;border-radius:2px;">PGUM 250NM</span>',
    className: '', iconSize: [76, 13], iconAnchor: [38, 6]
  });
  LY.pgum.push(L.marker(L.latLng(pgumApt.lat, pgumApt.lon), { icon: ic, interactive: false }).addTo(map));
  bringTop();
}
```

### B-3: チェックボックスを OVERLAYS バーに追加

`<label class="ck"><input type="checkbox" id="oEtops"...>` の直後に挿入:

**変更前:**
```html
    <label class="ck"><input type="checkbox" id="oEtops" onchange="toggleEtopsOpts()"> ETOPS rings</label>
```

**変更後:**
```html
    <label class="ck"><input type="checkbox" id="oEtops" onchange="toggleEtopsOpts()"> ETOPS rings</label>
    <label class="ck" id="pgum-ring-lbl" style="display:none;"><input type="checkbox" id="oPgum" checked onchange="drawPgumRing()"> PGUM 250NM</label>
```

### B-4: NAVLOG適用後に `drawPgumRing()` を呼ぶ

NAVLOG適用後の `drawEtops();` の直後に追加:

```javascript
  drawEtops();
  drawPgumRing();   // ← 追加
  frameRoute();
```

### B-5: SYD便判定でチェックボックスの表示/非表示を制御

`drawPgumRing()` 関数の先頭（`LY.pgum.forEach` の直前）に以下を追加:

```javascript
  var pgumLbl = document.getElementById('pgum-ring-lbl');
  var isSyd = (typeof NAV_DEST === 'string' && NAV_DEST === 'YSSY');
  if(pgumLbl) pgumLbl.style.display = isSyd ? '' : 'none';
  if(!isSyd) return;
```

つまり `drawPgumRing()` の完成形は:

```javascript
function drawPgumRing() {
  var pgumLbl = document.getElementById('pgum-ring-lbl');
  var isSyd = (typeof NAV_DEST === 'string' && NAV_DEST === 'YSSY');
  if(pgumLbl) pgumLbl.style.display = isSyd ? '' : 'none';
  LY.pgum.forEach(function(l){ try { map.removeLayer(l); } catch(e) {} });
  LY.pgum = [];
  if(!isSyd) return;
  var cb = document.getElementById('oPgum');
  if(!cb || !cb.checked) return;
  var pgumApt = APT['PGUM'];
  if(!pgumApt) return;
  var worldLngOffsets = [-360, 0, 360];
  for(var wi = 0; wi < worldLngOffsets.length; wi++) {
    var off = worldLngOffsets[wi];
    var c = L.circle([pgumApt.lat, pgumApt.lon + off], {
      radius: 250 * NM,
      color: 'rgba(79,195,247,0.7)',
      weight: 1.5,
      fill: false,
      dashArray: '6 4'
    }).addTo(map);
    c.bindTooltip('PGUM 250NM', { className: 'wxt', sticky: true });
    LY.pgum.push(c);
  }
  var ic = L.divIcon({
    html: '<span style="font-size:9px;color:rgba(79,195,247,.9);font-family:monospace;'
        + 'background:rgba(6,10,20,.85);padding:1px 4px;border-radius:2px;">PGUM 250NM</span>',
    className: '', iconSize: [76, 13], iconAnchor: [38, 6]
  });
  LY.pgum.push(L.marker(L.latLng(pgumApt.lat, pgumApt.lon), { icon: ic, interactive: false }).addTo(map));
  bringTop();
}
```

### B-6: `clearFpl()` でリングを消す

`clearFpl()` 内の `if(typeof drawEtops === 'function') drawEtops();` の直後に追加:

```javascript
  if(typeof drawPgumRing === 'function') drawPgumRing();
```

### B-7: `bringTop()` に pgum を追加

`bringTop()` 内の `LY.etops.forEach(...)` の直前に追加:

```javascript
  LY.pgum.forEach(function(l){try{l.bringToFront();}catch(e){}});
```

---

## 実装順序

Step A → commit → Step B → commit

**Step B の確認事項:**
- 非SYD便: `PGUM 250NM` チェックボックスが表示されない
- SYD便（YSSY）: チェックボックスが現れ、初期状態でチェック済み、PGUM中心の水色破線の円が表示される
- チェックを外すと円が消え、再度入れると表示される
- NAVLOG クリア後: 円が消え、チェックボックスも非表示になる
