# 指示書：ATO 手動編集時の後続 WP 再計算

対象ファイル: `index.html`
ES5厳守

---

## 概要

現在の動作:
- UTC が WP の ETO を過ぎると自動で ATO が入力される（30秒ごとのタイマー）

追加する動作:
- ユーザーが任意の WP の ATO を手動編集したとき、
  それ以降の全 WP を「現在 UTC 基準」で再計算する
- 再計算結果が「まだ到達していない時刻」の WP は、
  既に自動入力されていた ATO もクリアする

---

## 具体例

WP A（ctme 0）, B（ctme 60分）, C（ctme 120分）が自動入力済みの状態で
ユーザーが A の ATO を書き換えた場合:

- B の想定 ATO ＝ 新 A の ATO ＋ 60分
- C の想定 ATO ＝ 新 A の ATO ＋ 120分
- 現在 UTC ≧ 想定 ATO → ATO を更新（上書き）
- 現在 UTC ＜ 想定 ATO → ATO を消去（自動入力を取り消す）

---

## Step 1: `recalcSubsequentAtos()` 関数を追加

`onAtoChange` 関数の直前に挿入:

```javascript
// ── ATO 再計算: 指定インデックス以降の WP を現在 UTC 基準で更新/消去 ──
function recalcSubsequentAtos(fromIdx) {
  if(!FP_ROWS || !FP_ROWS.length) return false;

  var now    = new Date();
  var nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();

  // 起点行の ATO と CTME を取得
  var refRow = FP_ROWS[fromIdx];
  if(!refRow) return false;

  var refCtme   = refRow.ctme;
  var refAtoMin = (refRow.ato && String(refRow.ato).trim() !== '')
                    ? hhmmToMins(String(refRow.ato).trim()) : null;

  if(refCtme === null || refCtme === undefined) return false;

  var changed = false;

  // 起点の ATO が空 → 以降を全消去
  if(refAtoMin === null) {
    for(var j = fromIdx + 1; j < FP_ROWS.length; j++) {
      var rj = FP_ROWS[j];
      if(!rj) continue;
      if(typeof rj.id === 'string' && rj.id.charAt(0) === '-') continue;
      if(rj.ato && String(rj.ato).trim() !== '') {
        rj.ato = '';
        changed = true;
      }
    }
    return changed;
  }

  // 以降の WP を順番に再計算
  for(var i = fromIdx + 1; i < FP_ROWS.length; i++) {
    var row = FP_ROWS[i];
    if(!row) continue;
    // FIR 境界行はスキップ（ATO 不要）
    if(typeof row.id === 'string' && row.id.charAt(0) === '-') continue;
    if(row.ctme === null || row.ctme === undefined) continue;

    // この WP の想定 ATO = 基準 ATO ＋ CTME 差分
    var expectedMin = (refAtoMin + (row.ctme - refCtme) + 1440) % 1440;

    // 現在 UTC と比較（日付またぎ対応）
    var diff = nowMin - expectedMin;
    if(diff >  720) diff -= 1440;
    if(diff < -720) diff += 1440;

    if(diff >= 0) {
      // 到達済み → ATO を設定（上書き）
      row.ato = minsToHHMM(expectedMin);
      changed = true;
    } else {
      // 未到達 → ATO を消去
      if(row.ato && String(row.ato).trim() !== '') {
        row.ato = '';
        changed = true;
      }
    }

    // 次の WP の基準点を更新（想定値で連鎖計算）
    refAtoMin = expectedMin;
    refCtme   = row.ctme;
  }

  return changed;
}
```

---

## Step 2: `onAtoChange()` を修正

現在の `onAtoChange` 関数:

```javascript
function onAtoChange(idx,val) {
  FP_ROWS[idx].ato = val.trim();
  if(idx===0) {
    // ... 既存の DEP_ATO_MIN 更新処理 ...
  }
  renderFpTable();
  // ...
}
```

`FP_ROWS[idx].ato = val.trim();` の行の直後（`if(idx===0)` ブロックの前）に追加:

```javascript
  // 後続 WP の ATO を再計算（時刻到達済み=更新, 未到達=消去）
  recalcSubsequentAtos(idx);
```

完成形（関数全体を参考として記載）:

```javascript
function onAtoChange(idx, val) {
  FP_ROWS[idx].ato = val.trim();

  // ★ 後続 WP の ATO を再計算
  recalcSubsequentAtos(idx);

  if(idx === 0) {
    var prevAto = DEP_ATO_MIN;
    DEP_ATO_MIN = hhmmToMins(val.trim());
    if(prevAto !== null && DEP_ATO_MIN !== null) {
      var atoDiff = DEP_ATO_MIN - prevAto;
      if(window.WXR_DEBUG === true) {
        console.debug('[FLTPLN] first ATO offset min=', atoDiff);
      }
    }
    if(document.getElementById('dep').checked) {
      console.log('DEP_ATO_MIN updated:', DEP_ATO_MIN, '→ calcRoutePos:', calcRoutePos());
    }
    if(typeof syncWpEtoUtcFromSchedule === 'function') syncWpEtoUtcFromSchedule();
    if(typeof gfsRadarInvalidateRoutePointsMemo === 'function') gfsRadarInvalidateRoutePointsMemo();
    if(typeof WX_GFS_CORR_ON !== 'undefined' && WX_GFS_CORR_ON &&
        typeof applyGfsRadarForCurrentMethod === 'function') {
      applyGfsRadarForCurrentMethod();
    }
  }
  renderFpTable();
  if(document.getElementById('dep') && document.getElementById('dep').checked) {
    if(typeof fetchAc === 'function') fetchAc();
  }
  if(typeof renderAtmGfsValidUtcRow === 'function') renderAtmGfsValidUtcRow();
}
```

---

## 動作まとめ

| 操作 | 動作 |
|---|---|
| WP A の ATO を書き換える | B, C, D ... を現在 UTC 基準で再計算 |
| 再計算した B の時刻が過去 | B の ATO を更新（上書き） |
| 再計算した C の時刻が未来 | C の ATO を消去（自動入力取り消し） |
| ATO 欄を空白にする | 以降の全 WP の ATO を消去 |
| 途中 WP の ATO を編集（例: B） | B 以降のみ再計算、A は変更なし |

---

## 確認事項

- WP A, B, C が全て自動入力済みの状態で A を 10分繰り上げ編集
  → B, C の ATO も 10分繰り上がる
- A を大幅に繰り下げ編集して B の想定時刻が未来になる
  → B, C の ATO が消える（タイマーが再度 ATO を入れるまで空欄）
- ATO 欄を空白にクリア
  → 以降の WP が全消え、tickAtoAutoFill が引き続き正常動作する
- 既存の tickAtoAutoFill（30秒ごと）には変更なし
  → 手動編集後もタイマーが動き続け、時刻が来たら再び自動入力される

---

## 注意

`recalcSubsequentAtos` は `refAtoMin` / `refCtme` を「想定値」で連鎖させる。
たとえ途中の WP で ATO を消去しても、その想定時刻を基準として
次の WP の想定時刻を計算する。これにより、全 WP が正しい間隔で
再計算される。
