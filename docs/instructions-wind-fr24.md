# 指示書：Wind矢羽根・時刻表示・FR24ボタン

対象ファイル: `index.html` / `gfs-wind-layer.js`
ES5厳守（var, function宣言, 文字列連結のみ）

---

## Step A: 矢羽根の向きをFXJP準拠に修正

**対象ファイル:** `gfs-wind-layer.js`

**問題:** `makeBarb` 関数内で `blowTo = (dirDeg + 180) % 360` としているため、スタッフが「風が吹いていく方向（TO方向）」を向いている。FXJPと同様に「風が吹いてくる方向（FROM方向）」にスタッフ先端が向くよう修正する。

**修正箇所:** `gfs-wind-layer.js` の `makeBarb` 関数末尾（現在104〜106行目付近）

**変更前:**
```javascript
    var blowTo = (dirDeg + 180) % 360;
    var rotDeg = blowTo - 90;
    return '<g transform="rotate(' + rotDeg + ')">' + parts.join('') + '</g>';
```

**変更後:**
```javascript
    var rotDeg = dirDeg - 90;
    return '<g transform="rotate(' + rotDeg + ')">' + parts.join('') + '</g>';
```

**確認:** 西風（270°）のとき、スタッフ先端が地図上で西（左）を向き、羽根が南側に出ることを確認する。

---

## Step B: Wind使用時刻のUI表示

**対象ファイル:** `index.html`

**目的:** Windチェック時にどの時刻のGFSデータを表示しているかをlegendエリアに表示する。  
現状は `windOverlayValidUtc()` でWP中間点のETOベース時刻を1つ使っているが、その時刻がUIに出ていない。

### B-1: ヘルパー関数の追加

`renderWxWindLegend` 関数の直前（約3024行目付近）に以下を追加する:

```javascript
function formatWindValidUtc(d) {
  if(!(d instanceof Date) || isNaN(d.getTime())) return '';
  var dd = d.getUTCDate();
  var hh = d.getUTCHours();
  var mm = d.getUTCMinutes();
  var pad2 = function(n){ return n < 10 ? '0' + n : '' + n; };
  return pad2(dd) + '/' + pad2(hh) + pad2(mm) + 'Z';
}
```

### B-2: `renderWxWindLegend` の `note` 部分を修正

**変更前（note設定部分）:**
```javascript
  if(note) {
    note.textContent = 'FL' + WX_GFS_WIND_FL + ' (kt)';
  }
```

**変更後:**
```javascript
  if(note) {
    var wVu = windOverlayValidUtc();
    var wVuStr = formatWindValidUtc(wVu);
    note.textContent = 'FL' + WX_GFS_WIND_FL + ' (kt)' + (wVuStr ? '  |  GFS ' + wVuStr : '');
  }
```

**確認:** Windチェックを入れるとlegend下部に `FL350 (kt)  |  GFS 13/1800Z` のような表示が出る。

> **Note（今後の拡張）:** 現在は全グリッドポイントに中間WPのvalidUtcを1つ使っている。将来的には各グリッドポイントに最近傍WPのETOを使う実装（`GfsWind.render` に `getValidUtc(lat, lon)` コールバックを渡す方式）に拡張可能。

---

## Step C: FR24ボタン追加

**対象ファイル:** `index.html`

### C-1: NAVLOGパース時に便名を抽出

`runParse` 関数内（`NAV_DEP = dep; NAV_DEST = dest;` の直後、約1975行目付近）に以下を追加:

```javascript
  // 便番号（例: ANA0006/50/23 → "ANA0006"、または NH123 形式）
  var fltM = txt.match(/\b(ANA\d{3,4})\b/);
  if(!fltM) fltM = txt.match(/\b(NH\d{3,4})\b/);
  NAV_FLT_NO = fltM ? fltM[1] : null;
```

### C-2: グローバル変数の宣言

`NAV_DEP` / `NAV_DEST` を宣言している行（約6380行目）を探し、`NAV_FLT_NO` を追加:

**変更前:**
```javascript
var NAV_DEP = null, NAV_DEST = null, NAV_STD = null, NAV_STA = null;
```

**変更後:**
```javascript
var NAV_DEP = null, NAV_DEST = null, NAV_STD = null, NAV_STA = null;
var NAV_FLT_NO = null;
```

### C-3: クリア時に便名もリセット

NAVLOGクリア処理（`NAV_DEST = null;` を含むブロック、約5113行目付近）に追加:

```javascript
  NAV_FLT_NO = null;
```

### C-4: FR24を開く関数の追加

`goToAircraft` 関数（約8007行目）の直前に追加:

```javascript
function openFR24() {
  var base = 'https://www.flightradar24.com/';
  var url;
  if(NAV_FLT_NO) {
    url = base + NAV_FLT_NO.toUpperCase();
  } else {
    url = base;
  }
  window.open(url, '_blank');
}
```

### C-5: ボタンのHTML追加

`goToAircraft()` ボタンの直後（約259行目）にFR24ボタンを挿入:

**変更前:**
```html
    <button class="btn" onclick="goToAircraft()">現在位置表示</button>
```

**変更後:**
```html
    <button class="btn" onclick="goToAircraft()">現在位置表示</button>
    <button class="btn" onclick="openFR24()" style="background:rgba(255,152,0,.15);color:#ff9800;border-color:#ff9800;" title="FlightRadar24で開く">FR24</button>
```

**確認事項:**
- NAVLOGなし → `https://www.flightradar24.com/` が別ウィンドウで開く
- NAVLOG適用後（例: ANA0006便）→ `https://www.flightradar24.com/ANA0006` が開く
- ボタンはオレンジ系デザインで `現在位置表示` の右に並ぶ

---

## 実装順序

Step A → commit → Step B → commit → Step C → commit

各Step独立しているので1つずつ確認しながら進める。
