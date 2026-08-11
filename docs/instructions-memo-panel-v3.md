# 指示書：MEMO パネル追加修正 v3

対象ファイル: `index.html`
ES5厳守（var, function宣言, 文字列連結のみ）

`instructions-memo-panel-v2.md` の実装に対する差分パッチ。

---

## 変更概要

① CREW人数（Cockpit＋Cabin合計）をRMK行のPAX横に `TTL XX` として追加  
② WXの下に `Performance:` セクション（Return / CLB Gradient）を新設

---

## 期待出力例

```
RMK: PAX 280 TTL 11
Turbulence:
WX: 12/21℃ ○
Performance:
Return
CLB Gradient
```

- `TTL 11` = CREW 02/09 の合計（2+9=11）
- `Performance:` 以下は手動記入用の固定テンプレート

---

## パッチ①: グローバル変数追加（Step 1）

`NAV_PTOW_LBS = null;` の直後に追加:

```javascript
var NAV_CREW_TOTAL = null;  // Cockpit + Cabin crew 合計
```

---

## パッチ②: NAVLOGパース追加（Step 2）

`NAV_PTOW_LBS` のパース (`var ptowM = ...`) の直後に追加:

```javascript
  // CREW  例: "CREW 02/09" → Cockpit=2, Cabin=9, Total=11
  var crewM = txt.match(/CREW\s+(\d+)\/(\d+)/);
  NAV_CREW_TOTAL = crewM ? (parseInt(crewM[1], 10) + parseInt(crewM[2], 10)) : null;
```

---

## パッチ③: clearFpl() に追加（Step 3）

`NAV_PTOW_LBS = null;` の直後に追加:

```javascript
  NAV_CREW_TOTAL = null;
```

---

## パッチ④: buildMemoText() の変更（Step 5）

### RMK行 — TTL追加

**変更前:**
```javascript
  lines.push('RMK:' + (NAV_PAX !== null ? ' PAX ' + NAV_PAX : ''));
```

**変更後:**
```javascript
  var rmkLine = 'RMK:';
  if(NAV_PAX !== null) rmkLine += ' PAX ' + NAV_PAX;
  if(NAV_CREW_TOTAL !== null) rmkLine += ' TTL ' + NAV_CREW_TOTAL;
  lines.push(rmkLine);
```

### 末尾 — Performance セクション追加

**変更前:**
```javascript
  lines.push('Turbulence:');
  lines.push('WX:');
```

**変更後:**
```javascript
  lines.push('Turbulence:');
  lines.push('WX:');
  lines.push('Performance:');
  lines.push('Return');
  lines.push('CLB Gradient');
```

---

## 確認

- NAVLOG適用後、RMK行が `RMK: PAX 280 TTL 11` のように表示される
- CREW情報がNAVLOGにない場合は `RMK: PAX 280`（TTL省略）
- WXの下に `Performance:` / `Return` / `CLB Gradient` の3行が続く
- すべてテキストエリア内で手動編集可能
