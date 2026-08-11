# 指示書：ATO欄 空欄化 & 自動入力

対象ファイル: `index.html`
ES5厳守（var, function宣言, 文字列連結のみ）

---

## 仕様

- ATO欄のplaceholderを空欄にする
- 出発WP（idx=0）のATOは従来通り手動入力
- idx=1以降のWPについて: **現在UTC時刻が「直前の最後のATO + 次WPまでのZTME」に達したとき、その時刻をATOに自動入力する**
- ずれ（早着・遅着）は後続WPに伝播する（例: WP CのATOが1分早ければ、WP D以降も1分早く自動入力される）
- ETOはFLT PLN基準のまま変わらない
- 既に入力済みのATOは上書きしない
- 30秒ごとにチェック、NAVLOG適用で開始、NAVLOGクリアで停止

---

## Step 1: ATO欄のplaceholderを空欄に変更

`renderFpTable` 内のATO入力セル生成部分を修正:

**変更前:**
```javascript
      '<td style="padding:3px 4px;"><input class="fp-in" value="'+row.ato+'" placeholder="HHMM" onchange="onAtoChange('+idx+',this.value)"></td>'+
```

**変更後:**
```javascript
      '<td style="padding:3px 4px;"><input class="fp-in" value="'+row.ato+'" placeholder="" onchange="onAtoChange('+idx+',this.value)"></td>'+
```

---

## Step 2: グローバル変数の追加

`var DEP_ATO_MIN = null;` の行の近く（約877行）に追加:

```javascript
var ATO_AUTO_INT = null;
```

---

## Step 3: 自動入力関数の追加

`onAtoChange` 関数（約2591行）の直前に以下を挿入:

```javascript
function tickAtoAutoFill() {
  if(typeof FP_ROWS === 'undefined' || !FP_ROWS || !FP_ROWS.length) return;
  var now = new Date();
  var nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();

  // 最後にATOが入力されているWPを基準点として探す
  var lastAtoMin = null;
  var lastAtoCtme = null;
  var lastAtoIdx = -1;
  var i, row, atoMin;
  for(i = 0; i < FP_ROWS.length; i++) {
    row = FP_ROWS[i];
    if(!row || !row.ato || String(row.ato).trim() === '') continue;
    if(typeof row.id === 'string' && row.id.charAt(0) === '-') continue;
    if(row.ctme === null || row.ctme === undefined) continue;
    atoMin = hhmmToMins(String(row.ato).trim());
    if(atoMin === null) continue;
    lastAtoMin = atoMin;
    lastAtoCtme = row.ctme;
    lastAtoIdx = i;
  }
  if(lastAtoIdx === -1 || lastAtoMin === null) return;

  // 以降のATOが空のWPを順に処理
  var changed = false;
  var triggerMin, diff;
  for(i = lastAtoIdx + 1; i < FP_ROWS.length; i++) {
    row = FP_ROWS[i];
    if(!row) continue;
    if(typeof row.id === 'string' && row.id.charAt(0) === '-') continue;
    // ATOが入力済みの場合は基準点を更新してスキップ
    if(row.ato && String(row.ato).trim() !== '') {
      atoMin = hhmmToMins(String(row.ato).trim());
      if(atoMin !== null && row.ctme !== null && row.ctme !== undefined) {
        lastAtoMin = atoMin;
        lastAtoCtme = row.ctme;
      }
      continue;
    }
    if(row.ctme === null || row.ctme === undefined) continue;
    // トリガー時刻 = 直前のATO + ZTME（ctme差分）
    triggerMin = (lastAtoMin + (row.ctme - lastAtoCtme) + 1440) % 1440;
    diff = nowMin - triggerMin;
    if(diff > 720) diff -= 1440;
    if(diff < -720) diff += 1440;
    if(diff >= 0) {
      row.ato = minsToHHMM(triggerMin);
      lastAtoMin = triggerMin;
      lastAtoCtme = row.ctme;
      changed = true;
    } else {
      break; // 以降のWPはまだ時刻未到達
    }
  }
  if(changed && typeof renderFpTable === 'function') renderFpTable();
}

function startAtoAutoFill() {
  if(ATO_AUTO_INT) { clearInterval(ATO_AUTO_INT); ATO_AUTO_INT = null; }
  if(typeof FP_ROWS === 'undefined' || !FP_ROWS || FP_ROWS.length < 2) return;
  ATO_AUTO_INT = setInterval(tickAtoAutoFill, 30000);
  tickAtoAutoFill();
}

function stopAtoAutoFill() {
  if(ATO_AUTO_INT) { clearInterval(ATO_AUTO_INT); ATO_AUTO_INT = null; }
}
```

---

## Step 4: NAVLOG適用後に開始

NAVLOG適用後の `drawPgumRing();` の直後に追加:

```javascript
  drawPgumRing();
  startAtoAutoFill();   // ← 追加
  frameRoute();
```

---

## Step 5: NAVLOGクリア時に停止

`clearFpl()` 内の `stopAtoAutoFill` 呼び出しを追加。
`if(typeof drawPgumRing === 'function') drawPgumRing();` の直後:

```javascript
  if(typeof drawPgumRing === 'function') drawPgumRing();
  if(typeof stopAtoAutoFill === 'function') stopAtoAutoFill();   // ← 追加
```

---

## 動作まとめ

| 状況 | 動作 |
|---|---|
| NAVLOG未適用 | ATO欄は空欄（placeholderなし） |
| NAVLOG適用後 | 30秒ごとにチェック |
| ATO未入力が1つもない | チェックをスキップ（出発ATOが入るまで待機） |
| 現在時刻 ≥ 直前ATO + ZTME | ATOにその時刻を自動入力 → テーブル再描画 |
| 入力済みATOは基準点を更新 | ずれ（早着・遅着）が後続WPに伝播 |
| ATO手動/自動入力済み | 上書きしない |
| NAVLOGクリア | 自動入力インターバル停止 |

---

## 確認

- ATO欄が初期状態で空欄になること
- WP Aに ATO 11:20 を手動入力、ZTME=2のWP BでUTCが11:22になったとき「11:22」が自動入力されること
- WP Cが1分早く（11:21）ATOに入った場合、WP DはFLT PLNより1分早く自動入力されること
- 手動入力したATOは自動入力で上書きされないこと
- NAVLOGクリア後に自動入力が止まること
