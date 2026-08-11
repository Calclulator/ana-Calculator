# 指示書：Planning MEMO パネル新設

対象ファイル: `index.html`
ES5厳守（var, function宣言, 文字列連結のみ）

---

## 概要

- 左メニューの **Planning** セクションに「📝 MEMO」ボタンを追加
- 新しい `memo-panel` を作成
- NAVLOGから各値を自動抽出し、Turbulence・WX と合わせて**1つのテキストエリア**に表示
- コピペしやすいよう、すべてプレーンテキスト形式

**表示フォーマット（イメージ）:**
```
2026/07/17  ANA0880 YSSY→RJTT
1055Z	2045Z
09+50	09+10 (40min)				SS: — / SR: 1927Z
RJGG	12.8 (RSV:4.3/ALT:8.5)
FOB:	120.5	FOD: 22.7
PTOW: 424.3	MLDW: 425.0
RMK:
Turbulence:
WX:
```

フォーマット詳細:
- 1行目: `日付  便名 出発→到着`
- 2行目: `STD時刻Z タブ STA時刻Z`（ラベルなし）
- 3行目: `B/T(HH+MM) タブ F/T(HH+MM) (差min) タブ×3 SS: — or 時刻Z / SR: — or 時刻Z`
- 4行目: `ALT空港名 タブ RSV+ALT合計 (RSV:x/ALT:y)`（EDCTあれば末尾に追加）
- 5行目: `FOB: タブ 値 タブ FOD: 値`
- 6行目: `PTOW: 値 タブ MLDW: 値`
- 7行目: `RMK:`（空欄）
- 8行目: `Turbulence:`（空欄）
- 9行目: `WX:`（空欄）

---

## Step 1: グローバル変数の追加

`var NAV_MLDW = null;` の近く（約875行）に以下を追加:

```javascript
var NAV_BT_STR = null;      // Block Time 文字列 e.g. "09:35"
var NAV_FT_STR = null;      // Flight Time 文字列 e.g. "08:49"
var NAV_SS_STR = null;      // Sunset e.g. "17:22Z" or null
var NAV_SR_STR = null;      // Sunrise e.g. "05:12Z" or null
var NAV_EDCT_STR = null;    // EDCT e.g. "1234Z" or null
var NAV_RSV_LBS = null;     // RSV fuel (lbs)
var NAV_ALT_APT = null;     // ALT airport ICAO (larger fuel value)
var NAV_ALT_LBS = null;     // ALT fuel (lbs, larger value)
var NAV_FOB_LBS = null;     // FOB (lbs)
var NAV_FOD_LBS = null;     // FOD (lbs)
var NAV_PAX = null;         // PAX数
var NAV_PTOW_LBS = null;    // PTOW (lbs)
```

---

## Step 2: NAVLOGパース関数に追加

`NAV_STA` のパース（`var staM = txt.match(...)` ）の直後に以下を挿入:

```javascript
  // B/T (Block Time)
  var btM = txt.match(/B\/T\s+(\d{2})HR(\d{2})MIN/);
  NAV_BT_STR = btM ? (btM[1] + ':' + btM[2]) : null;

  // F/T (Flight Time)
  var ftM = txt.match(/F\/T\s+(\d{2})HR(\d{2})MIN/);
  NAV_FT_STR = ftM ? (ftM[1] + ':' + ftM[2]) : null;

  // SS / SR  例: "SS 17:22 / T SR05:12/099T"
  var ssM = txt.match(/\bSS\s+(\d{2}):(\d{2})/);
  NAV_SS_STR = ssM ? (ssM[1] + ':' + ssM[2] + 'Z') : null;
  var srM = txt.match(/\bSR(\d{2}):(\d{2})/);
  NAV_SR_STR = srM ? (srM[1] + ':' + srM[2] + 'Z') : null;

  // EDCT (値がある場合のみ)
  var edctM = txt.match(/EDCT:\s*(\d{4}Z?)/);
  NAV_EDCT_STR = edctM ? edctM[1] : null;

  // FUEL PLAN: RSV
  var rsvM = txt.match(/^RSV\s+\d{2}\/\d{2}\s+(\d+)/m);
  NAV_RSV_LBS = rsvM ? parseInt(rsvM[1]) : null;

  // FUEL PLAN: ALT (2列ある場合は大きい方の空港と燃料を採用)
  // 例: "ALT KONT 00/28 009700      00/00 000000"
  // 例: "ALT KONT 00/28 009700 RJGG 00/20 007200"
  NAV_ALT_APT = null; NAV_ALT_LBS = null;
  var altLineM = txt.match(/^ALT\s+([A-Z]{4})\s+\d{2}\/\d{2}\s+(\d+)(?:\s+([A-Z]{4})\s+\d{2}\/\d{2}\s+(\d+))?/m);
  if(altLineM) {
    var apt1 = altLineM[1], f1 = parseInt(altLineM[2]);
    var apt2 = altLineM[3] || null, f2 = altLineM[4] ? parseInt(altLineM[4]) : 0;
    if(apt2 && f2 > f1) {
      NAV_ALT_APT = apt2; NAV_ALT_LBS = f2;
    } else {
      NAV_ALT_APT = apt1; NAV_ALT_LBS = f1;
    }
  }

  // FOB
  var fobM = txt.match(/^FOB\s+\d{2}\/\d{2}\s+(\d+)/m);
  NAV_FOB_LBS = fobM ? parseInt(fobM[1]) : null;

  // FOD
  var fodM = txt.match(/FOD=(\d+)LB/);
  NAV_FOD_LBS = fodM ? parseInt(fodM[1]) : null;

  // WT PLAN: PAX, PTOW
  var paxM = txt.match(/PAX\s+(\d+)\//);
  NAV_PAX = paxM ? parseInt(paxM[1]) : null;
  var ptowM = txt.match(/PTOW\s+(\d+)/);
  NAV_PTOW_LBS = ptowM ? parseInt(ptowM[1]) : null;
```

---

## Step 3: clearFpl() にクリア処理を追加

`NAV_FLT_NO = null;` の近くに追加:

```javascript
  NAV_BT_STR = null; NAV_FT_STR = null;
  NAV_SS_STR = null; NAV_SR_STR = null; NAV_EDCT_STR = null;
  NAV_RSV_LBS = null; NAV_ALT_APT = null; NAV_ALT_LBS = null;
  NAV_FOB_LBS = null; NAV_FOD_LBS = null;
  NAV_PAX = null; NAV_PTOW_LBS = null;
  if(typeof renderMemoPanel === 'function') renderMemoPanel();
```

---

## Step 4: showTab() に memo を追加

`showTab` 関数内のパネルID配列に `'memo'` を追加:

**変更前:**
```javascript
  ['wx','fp','atm','atm-gfs','crew-rest','fdp'].forEach(function(n) {
```

**変更後:**
```javascript
  ['wx','fp','atm','atm-gfs','crew-rest','fdp','memo'].forEach(function(n) {
```

---

## Step 5: renderMemoPanel() 関数の追加

`clearFpl` 関数の直前に以下を挿入:

```javascript
function buildMemoText() {
  function klbs(lbs) {
    if(lbs === null || lbs === undefined) return '—';
    return (lbs / 1000).toFixed(1);
  }
  function hhmm(str) {
    // "09:35" → "09+35"
    if(!str) return '—';
    return str.replace(':', '+');
  }
  var lines = [];

  // 1行目: 日付  便名 出発→到着
  var now = new Date();
  var dd = now.getUTCFullYear() + '/'
    + ('0'+(now.getUTCMonth()+1)).slice(-2) + '/'
    + ('0'+now.getUTCDate()).slice(-2);
  var fltNo = NAV_FLT_NO || '';
  var route = (NAV_DEP && NAV_DEST) ? (' ' + NAV_DEP + '→' + NAV_DEST) : '';
  lines.push(dd + (fltNo ? ('  ' + fltNo) : '') + route);

  // 2行目: STD時刻Z タブ STA時刻Z (ラベルなし)
  var stdStr = NAV_STD ? (NAV_STD.slice(0,2)+NAV_STD.slice(2)+'Z') : '—';
  var staStr = NAV_STA ? (NAV_STA.slice(0,2)+NAV_STA.slice(2)+'Z') : '—';
  lines.push(stdStr + '\t' + staStr);

  // 3行目: B/T(HH+MM) タブ F/T(HH+MM) (差min) タブ×3 SS: x / SR: x
  var btStr = hhmm(NAV_BT_STR);
  var ftStr = hhmm(NAV_FT_STR);
  var diffStr = '';
  if(NAV_BT_STR && NAV_FT_STR) {
    var bp = NAV_BT_STR.split(':'), fp2 = NAV_FT_STR.split(':');
    var d = (parseInt(bp[0])*60+parseInt(bp[1])) - (parseInt(fp2[0])*60+parseInt(fp2[1]));
    diffStr = ' (' + d + 'min)';
  }
  var ssStr = 'SS: ' + (NAV_SS_STR || '—') + ' / SR: ' + (NAV_SR_STR || '—');
  lines.push(btStr + '\t' + ftStr + diffStr + '\t\t\t' + ssStr);

  // 4行目: ALT空港名 タブ RSV+ALT合計 (RSV:x/ALT:y)  [EDCT あれば末尾]
  var rsvVal = klbs(NAV_RSV_LBS);
  var altVal = klbs(NAV_ALT_LBS);
  var altApt = NAV_ALT_APT || '—';
  var rsvAltTotal = (NAV_RSV_LBS !== null && NAV_ALT_LBS !== null)
    ? ((NAV_RSV_LBS + NAV_ALT_LBS) / 1000).toFixed(1) : '—';
  var line4 = altApt + '\t' + rsvAltTotal + ' (RSV:' + rsvVal + '/ALT:' + altVal + ')';
  if(NAV_EDCT_STR) line4 += '  EDCT: ' + NAV_EDCT_STR;
  lines.push(line4);

  // 5行目: FOB: タブ 値 タブ FOD: 値
  lines.push('FOB:\t' + klbs(NAV_FOB_LBS) + '\tFOD: ' + klbs(NAV_FOD_LBS));

  // 6行目: PTOW: 値 タブ MLDW: 値
  var ptowVal = NAV_PTOW_LBS !== null ? klbs(NAV_PTOW_LBS) : '—';
  var mldwVal = NAV_MLDW !== null ? NAV_MLDW.toFixed(1) : '—';
  lines.push('PTOW: ' + ptowVal + '\tMLDW: ' + mldwVal);

  lines.push('RMK:');
  lines.push('Turbulence:');
  lines.push('WX:');

  return lines.join('\n');
}

function renderMemoPanel() {
  var ta = document.getElementById('memo-textarea');
  if(!ta) return;
  if(!NAV_DEP && !NAV_DEST) {
    ta.value = '（NAVLOGを適用すると自動入力されます）\n\nRMK:\nTurbulence:\nWX:';
    return;
  }
  ta.value = buildMemoText();
}
```

---

## Step 6: NAVLOG適用後に呼ぶ

`startAtoAutoFill();` の直後に追加:

```javascript
  startAtoAutoFill();
  if(typeof renderMemoPanel === 'function') renderMemoPanel();  // ← 追加
```

---

## Step 7: nav メニューにボタン追加

左メニューの Planning セクション（`📋 FLT PLN` ボタンの直後）に追加:

```html
      <button class="nav-item" id="nav-memo" onclick="navTo('memo')">📝 MEMO</button>
```

---

## Step 8: memo-panel の HTML を追加

`<!-- ===== FLIGHT PLAN ===== -->` の直前に挿入:

```html
<!-- ===== MEMO ===== -->
<div id="memo-panel" class="panel">
  <div class="bar">
    <span style="color:#4fc3f7;font-weight:bold;letter-spacing:.08em;">MEMO</span>
    <button class="btn" onclick="renderMemoPanel()" style="margin-left:auto;" title="NAVLOGから再生成">↺ 再生成</button>
  </div>
  <div style="display:flex;flex-direction:column;height:calc(100% - 44px);padding:12px 14px;box-sizing:border-box;">
    <textarea id="memo-textarea" spellcheck="false"
      style="flex:1;width:100%;box-sizing:border-box;background:#080c14;border:1px solid #1e2a38;border-radius:6px;color:#cfd8dc;font-family:'Helvetica Neue',Arial,monospace;font-size:14px;line-height:1.8;padding:12px 14px;resize:none;outline:none;tab-size:20;"
      placeholder="（NAVLOGを適用すると自動入力されます）&#10;&#10;Turbulence:&#10;&#10;&#10;WX:&#10;"></textarea>
  </div>
</div>
```

---

## 確認事項

- Planning メニューに「📝 MEMO」が表示される
- NAVLOG適用後、テキストエリアに以下が入る:
  ```
  2026/07/17  ANA0006 RJAA→KLAX
  0815Z	1750Z
  09+35	08+49 (46min)			SS: — / SR: 05:12Z
  KONT	18.0 (RSV:8.3/ALT:9.7)  EDCT: 1234Z
  FOB:	216.8	FOD: 27.4
  PTOW: 715.0	MLDW: 388.9
  RMK:
  Turbulence:
  WX:
  ```
- SS/SRは常に表示（値がなければ —）
- EDCTは値がある場合のみ4行目末尾に追加
- テキストエリアは自由編集可能
- 「↺ 再生成」ボタンでNAVLOGから再生成（手動編集内容はリセット）
- NAVLOGクリア後はテンプレートに戻る

---

## 実装順序

Step 1〜3（パース）→ commit → Step 4〜8（UI）→ commit
