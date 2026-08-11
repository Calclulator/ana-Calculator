# 指示書：Curfew Calculator

対象ファイル: `index.html`
ES5厳守（var, function宣言, 文字列連結のみ）

---

## 概要

Calculators セクションに「🕒 Curfew」ボタンを追加。
空港の閉鎖時刻（または開放時刻）とフライトタイムから「最遅（最早）離陸時刻」を逆算する。
NAVLOGが適用済みの場合、飛行時間を自動入力する。

---

## 計算ロジック

```
最遅/最早 Wheels Up = 空港の開閉時刻(UTC) − フライトタイム
```

- **閉鎖時刻（Curfew）入力時** → 結果 = その時刻までに着陸するための最遅 Wheels Up
- **開放時刻（Opening）入力時** → 結果 = その時刻以降に着陸するための最早 Wheels Up
- 日付またぎ（例: 23:50 − 01:30 = 22:20 前日）は自動処理

---

## Step 1: showTab() に curfew を追加

```javascript
  ['wx','fp','atm','atm-gfs','crew-rest','fdp','memo','ccbrfg','dump','curfew'].forEach(function(n) {
```

---

## Step 2: Curfew 計算・描画関数の追加

`renderDumpPanel` 関数の直前に挿入:

```javascript
// ── Curfew Calculator ────────────────────────────────────────────

function calcCurfew() {
  var cHH = parseInt(document.getElementById('curfew-hh').value, 10);
  var cMM = parseInt(document.getElementById('curfew-mm').value, 10);
  var fH  = parseInt(document.getElementById('curfew-fh').value,  10);
  var fM  = parseInt(document.getElementById('curfew-fm').value,  10);

  var resultEl = document.getElementById('curfew-result');
  if(!resultEl) return;

  if(isNaN(cHH) || isNaN(cMM) || isNaN(fH) || isNaN(fM)) {
    resultEl.innerHTML = '<span style="color:#607d8b;">入力値を確認してください。</span>';
    return;
  }
  if(cHH < 0 || cHH > 23 || cMM < 0 || cMM > 59) {
    resultEl.innerHTML = '<span style="color:#ef5350;">時刻は 00:00〜23:59 の範囲で入力してください。</span>';
    return;
  }
  if(fH < 0 || fM < 0 || fM > 59 || (fH === 0 && fM === 0)) {
    resultEl.innerHTML = '<span style="color:#607d8b;">飛行時間を入力してください。</span>';
    return;
  }

  var curfewMin  = cHH * 60 + cMM;
  var flightMin  = fH  * 60 + fM;
  var wheelsUpMin = (curfewMin - flightMin + 1440) % 1440;

  var wuHH = Math.floor(wheelsUpMin / 60);
  var wuMM = wheelsUpMin % 60;
  var pad2 = function(n) { return n < 10 ? '0' + n : '' + n; };
  var wuStr = pad2(wuHH) + ':' + pad2(wuMM) + 'Z';

  // STDとの比較（NAVLOG適用済みの場合）
  var stdNote = '';
  if(NAV_STD) {
    var stdMin = parseInt(NAV_STD.slice(0,2),10)*60 + parseInt(NAV_STD.slice(2),10);
    var diff = stdMin - wheelsUpMin;
    if(diff > 720)  diff -= 1440;
    if(diff < -720) diff += 1440;
    if(diff <= 0) {
      stdNote = '<div style="margin-top:10px;color:#66bb6a;font-size:13px;">' +
        '✔ STD ' + NAV_STD.slice(0,2)+':'+NAV_STD.slice(2) + 'Z は制約内です。' +
        '（' + Math.abs(diff) + '分の余裕）</div>';
    } else {
      stdNote = '<div style="margin-top:10px;color:#ef5350;font-size:13px;">' +
        '✘ STD ' + NAV_STD.slice(0,2)+':'+NAV_STD.slice(2) + 'Z は制約を ' + diff + '分オーバーしています。</div>';
    }
  }

  resultEl.innerHTML =
    '<div style="color:#90a4ae;font-size:12px;margin-bottom:6px;">Wheels Up（UTC）</div>' +
    '<div style="font-size:40px;font-weight:bold;color:#eceff1;letter-spacing:.05em;">' + wuStr + '</div>' +
    '<div style="color:#546e7a;font-size:12px;margin-top:6px;">' +
      '空港時刻 ' + pad2(cHH)+':'+pad2(cMM)+'Z − 飛行時間 ' + fH + 'h' + pad2(fM) + 'm' +
    '</div>' +
    stdNote;
}

function clearCurfew() {
  var ids = ['curfew-hh','curfew-mm','curfew-fh','curfew-fm'];
  for(var i = 0; i < ids.length; i++) {
    var el = document.getElementById(ids[i]);
    if(el) el.value = '';
  }
  var resultEl = document.getElementById('curfew-result');
  if(resultEl) resultEl.innerHTML =
    '<span style="color:#607d8b;">入力値を入力して Wheels Up 時刻を計算します。</span>';
}

function renderCurfewPanel() {
  var panel = document.getElementById('curfew-panel');
  if(!panel) return;

  // NAVLOGからフライトタイムを取得
  var autoFH = '', autoFM = '';
  if(NAV_FT_STR) {
    var ftParts = NAV_FT_STR.split(':');
    autoFH = ftParts[0] || '';
    autoFM = ftParts[1] || '';
  }

  var inStyle = 'background:#0d1117;border:1px solid #1e2a38;border-radius:4px;' +
                'color:#eceff1;font-size:22px;padding:8px 12px;width:100%;box-sizing:border-box;' +
                'text-align:center;outline:none;';

  panel.innerHTML =
    '<div class="bar">' +
      '<span style="color:#4fc3f7;font-weight:bold;letter-spacing:.08em;">Curfew Calculator</span>' +
      '<button class="btn" onclick="clearCurfew()" style="margin-left:auto;">Clear data</button>' +
    '</div>' +
    '<div style="padding:20px 24px;max-width:720px;overflow-y:auto;height:calc(100% - 44px);box-sizing:border-box;">' +

      // INPUTS
      '<div style="border:1px solid #1e2a38;border-radius:8px;padding:20px;margin-bottom:16px;">' +
        '<div style="color:#4fc3f7;font-size:11px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:16px;">Inputs</div>' +

        // 空港開閉時刻
        '<div style="margin-bottom:20px;">' +
          '<div style="color:#cfd8dc;font-size:14px;font-weight:bold;margin-bottom:8px;">空港の開放・閉鎖時刻（UTC）</div>' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<input id="curfew-hh" type="number" min="0" max="23" placeholder="0"' +
              ' style="' + inStyle + 'width:120px;" oninput="calcCurfew()">' +
            '<span style="color:#cfd8dc;font-size:24px;font-weight:bold;">:</span>' +
            '<input id="curfew-mm" type="number" min="0" max="59" placeholder="0"' +
              ' style="' + inStyle + 'width:120px;" oninput="calcCurfew()">' +
          '</div>' +
          '<div style="color:#546e7a;font-size:11px;margin-top:6px;">時 (00〜23) ：分 (00〜59)</div>' +
        '</div>' +

        // フライトタイム
        '<div>' +
          '<div style="color:#cfd8dc;font-size:14px;font-weight:bold;margin-bottom:4px;">飛行時間の計画値</div>' +
          '<div style="color:#546e7a;font-size:12px;margin-bottom:8px;">ブロックタイム（Wheels Up〜着陸）' +
            (autoFH ? '　<span style="color:#4fc3f7;">NAVLOGより自動入力</span>' : '') + '</div>' +
          '<div style="display:flex;align-items:center;gap:14px;">' +
            '<div>' +
              '<input id="curfew-fh" type="number" min="0" max="24" placeholder="0"' +
                ' value="' + autoFH + '" style="' + inStyle + 'width:120px;" oninput="calcCurfew()">' +
              '<div style="color:#546e7a;font-size:11px;margin-top:4px;text-align:center;">時間</div>' +
            '</div>' +
            '<div>' +
              '<input id="curfew-fm" type="number" min="0" max="59" placeholder="0"' +
                ' value="' + autoFM + '" style="' + inStyle + 'width:120px;" oninput="calcCurfew()">' +
              '<div style="color:#546e7a;font-size:11px;margin-top:4px;text-align:center;">分</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

      '</div>' + // INPUTS終わり

      // RESULT
      '<div style="border:1px solid #1e2a38;border-radius:8px;padding:20px;min-height:100px;">' +
        '<div style="color:#4fc3f7;font-size:11px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:14px;">Result</div>' +
        '<div id="curfew-result">' +
          '<span style="color:#607d8b;">入力値を入力して Wheels Up 時刻を計算します。</span>' +
        '</div>' +
      '</div>' +

      '<div style="color:#546e7a;font-size:11px;margin-top:16px;text-align:center;">' +
        'プランニング用の目安です。実際の運航は会社スケジューリングで確認してください。' +
      '</div>' +

    '</div>';

  // NAVLOGが適用済みなら即計算
  if(autoFH && autoFM) { calcCurfew(); }
}
```

---

## Step 3: NAVLOG適用後に renderCurfewPanel() を呼ぶ

`renderDumpPanel()` 呼び出しの直後に追加:

```javascript
  if(typeof renderCurfewPanel === 'function') renderCurfewPanel();
```

---

## Step 4: メニューボタン追加

`⛽ Time to Dump` ボタンの直後:

```html
      <button class="nav-item" id="nav-curfew" onclick="navTo('curfew')">🕒 Curfew</button>
```

---

## Step 5: curfew-panel の HTML を追加

`<!-- ===== TIME TO DUMP ===== -->` の直前に挿入:

```html
<!-- ===== CURFEW CALCULATOR ===== -->
<div id="curfew-panel" class="panel">
  <!-- renderCurfewPanel() によって動的生成 -->
</div>
```

---

## Step 6: navTo('curfew') で renderCurfewPanel() を呼ぶ

`if(id === 'dump') renderDumpPanel();` の直後に追加:

```javascript
  if(id === 'curfew') renderCurfewPanel();
```

---

## 動作まとめ

| 状況 | 動作 |
|---|---|
| NAVLOG未適用 | 飛行時間欄は空欄、手動入力で計算 |
| NAVLOG適用済み | F/T を自動入力し即計算、STDとの比較も表示 |
| STD ≦ Wheels Up | 緑で「制約内 XX分の余裕」と表示 |
| STD ＞ Wheels Up | 赤で「XX分オーバー」と警告 |
| 入力値が不正 | エラーメッセージを表示 |

---

## 確認事項

- 空港時刻 `23:50`、飛行時間 `8h00m` → Wheels Up `15:50Z`
- 空港時刻 `06:00`、飛行時間 `8h00m` → Wheels Up `22:00Z`（前日扱い・日付またぎ正常動作）
- NAVLOGのF/Tが `08:49` の場合、飛行時間欄に `8h` / `49m` が自動入力される
- Clear data で全フィールドがリセットされる
