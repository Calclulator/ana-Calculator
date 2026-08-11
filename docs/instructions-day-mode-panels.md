# 指示書：Day Mode 対応（Holding / Dump / Curfew / CC BRFG）

対象ファイル: `index.html`
ES5厳守

---

## 概要

Holding / Time to Dump / Curfew / CC BRFG の各パネルは
動的レンダリングでインラインスタイルを使っているため、
Day mode の CSS では上書きできない。
以下の手順で対応する。

---

## Step 1: `getDayColors()` ヘルパー関数を追加

`toggleMode` 関数の直前に挿入:

```javascript
// ── Day/Night カラーヘルパー ───────────────────────────────────
function getDayColors() {
  var D = typeof DAY_MODE !== 'undefined' && DAY_MODE;
  return {
    bg:    D ? '#ffffff'               : '#0d1117',
    bg2:   D ? '#f5f7fa'               : '#111827',
    bg3:   D ? '#eef1f5'               : '#0d1421',
    text:  D ? '#1a2a3a'               : '#cfd8dc',
    hi:    D ? '#1a2a3a'               : '#eceff1',
    lbl:   D ? '#546e7a'               : '#607d8b',
    dim:   D ? '#78909c'               : '#546e7a',
    bdr:   D ? '#d0d8e4'               : '#1e2a38',
    acc:   D ? '#1565c0'               : '#4fc3f7',
    hlBg:  D ? 'rgba(21,101,192,.08)' : 'rgba(79,195,247,.08)',
    hlTxt: D ? '#1565c0'               : '#eceff1',
    cBg:   D ? '#f0f4f8'               : '#080c14',
    cGrid: D ? 'rgba(0,0,0,0.12)'     : 'rgba(255,255,255,0.1)',
    cLine: D ? '#2a3a4e'               : '#ffffff'
  };
}
```

---

## Step 2: `toggleMode()` に再レンダリング処理を追加

`toggleMode` 関数の最後、`applyMapTheme()` 呼び出しの直後:

```javascript
  // Day/Night 切り替え時にアクティブな動的パネルを再描画
  var activePanel = document.querySelector('.panel.active');
  if(activePanel && activePanel.id) {
    var tid = activePanel.id.replace('-panel', '');
    if(tid === 'holding' && typeof renderHoldingPanel === 'function') renderHoldingPanel();
    else if(tid === 'dump'    && typeof renderDumpPanel    === 'function') renderDumpPanel();
    else if(tid === 'curfew'  && typeof renderCurfewPanel  === 'function') renderCurfewPanel();
    else if(tid === 'ccbrfg'  && typeof renderCcBrfgPanel  === 'function') renderCcBrfgPanel();
    else if(tid === 'memo'    && typeof renderMemoPanel    === 'function') renderMemoPanel();
  }
```

---

## Step 3: `renderHoldingPanel()` と `updateHoldingTable()` をDay mode対応化

### 3-1. `renderHoldingPanel()` の先頭に追加

関数内の最初の `var` 宣言の前に:

```javascript
  var C = getDayColors();
```

### 3-2. `renderHoldingPanel()` 内の色置換

下記の文字列を関数内で一括置換:

| 置換前 | 置換後 |
|---|---|
| `'background:#0d1117;border:1px solid #1e2a38;border-radius:4px;' + 'color:#cfd8dc;font-size:13px;padding:6px 10px;width:100%;outline:none;'` | `'background:'+C.bg+';border:1px solid '+C.bdr+';border-radius:4px;color:'+C.text+';font-size:13px;padding:6px 10px;width:100%;outline:none;'` |
| `'background:#0d1117;border:1px solid #1e2a38;border-radius:4px;' + 'color:#cfd8dc;font-size:13px;padding:6px 10px;width:100%;box-sizing:border-box;outline:none;'` | `'background:'+C.bg+';border:1px solid '+C.bdr+';border-radius:4px;color:'+C.text+';font-size:13px;padding:6px 10px;width:100%;box-sizing:border-box;outline:none;'` |
| `'width:240px;min-width:200px;padding:16px 14px;box-sizing:border-box;' + 'border-right:1px solid #1e2a38;overflow-y:auto;'` | `'width:240px;min-width:200px;padding:16px 14px;box-sizing:border-box;border-right:1px solid '+C.bdr+';overflow-y:auto;'` |
| `color:#607d8b` | `color:'+C.lbl+'` ※文字列内の該当箇所すべて |
| `color:#546e7a` | `color:'+C.dim+'` ※文字列内の該当箇所すべて |
| `color:#cfd8dc` | `color:'+C.text+'` |

### 3-3. `updateHoldingTable()` の先頭に追加

```javascript
  var C = getDayColors();
```

### 3-4. `updateHoldingTable()` 内の色置換

| 置換前 | 置換後 |
|---|---|
| `'padding:10px 12px;text-align:left;font-weight:600;font-size:12px;color:#90a4ae;' + 'background:#0d1421;border-bottom:2px solid #1e2a38;white-space:nowrap;'` | `'padding:10px 12px;text-align:left;font-weight:600;font-size:12px;color:'+C.lbl+';background:'+C.bg3+';border-bottom:2px solid '+C.bdr+';white-space:nowrap;'` |
| `'padding:10px 12px;font-size:13px;border-bottom:1px solid #0d1421;'` | `'padding:10px 12px;font-size:13px;border-bottom:1px solid '+C.bg3+';'` |
| `tdBase + 'color:#cfd8dc;'` | `tdBase + 'color:'+C.text+';'` |
| `tdBase + 'color:#eceff1;'` | `tdBase + 'color:'+C.hi+';'` |
| `'background:#111827;border-radius:8px;overflow:hidden;'` | `'background:'+C.bg2+';border-radius:8px;overflow:hidden;'` |
| `'background:rgba(79,195,247,0.08);'` | `'background:'+C.hlBg+';'` |
| `'color:#4fc3f7;font-size:10px;font-weight:bold;margin-top:3px;'` | `'color:'+C.acc+';font-size:10px;font-weight:bold;margin-top:3px;'` |
| `'color:#546e7a;font-size:11px;margin-bottom:10px;'` | `'color:'+C.dim+';font-size:11px;margin-bottom:10px;'` |
| `'font-size:18px;font-weight:bold;color:#eceff1;'` | `'font-size:18px;font-weight:bold;color:'+C.hi+';'` |
| `'margin-top:12px;padding:10px 14px;background:rgba(255,152,0,.1);' + 'border:1px solid rgba(255,152,0,.3);border-radius:6px;color:#ff9800;font-size:12px;'` | そのまま（警告色は変更不要） |
| `'color:#607d8b;font-size:10px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;'` | `'color:'+C.lbl+';font-size:10px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;'` |
| `'color:#546e7a;font-size:12px;padding:3px 0 3px 10px;' + 'border-left:2px solid #1e2a38;margin-bottom:6px;'` | `'color:'+C.dim+';font-size:12px;padding:3px 0 3px 10px;border-left:2px solid '+C.bdr+';margin-bottom:6px;'` |
| `'color:#546e7a;font-size:11px;'` | `'color:'+C.dim+';font-size:11px;'` |

---

## Step 4: `renderHoldingPanel()` のテキストを日本語化

テーブルヘッダーのラベルを和訳:

| 置換前 | 置換後 |
|---|---|
| `'FIR'` (セクションラベル) | `'FIR'` (そのまま) |
| `'Manual Altitude (ft)'` | `'現在高度（ft）'` |
| `'現在高度を入力すると該当行をハイライト'` | そのまま |
| `updateHoldingTable()` 内の `'Levels<sup>1</sup>'` | `'高度帯<sup>1</sup>'` |
| `'Normal conditions'` | `'通常条件'` |
| `'Turbulence conditions'` | `'乱気流条件'` |
| `'Air Speed (IAS)'` | `'速度（IAS）'` |
| `'Altitude (MSL)'` | `'高度（MSL）'` |
| `'Airspeed (KIAS)'` | `'最大速度（KIAS）'` |
| `'Requirements &amp; Notes'` | `'適用条件・注意事項'` |

---

## Step 5: `renderDumpPanel()` をDay mode対応化

### 5-1. 関数先頭に追加

```javascript
  var C = getDayColors();
```

### 5-2. 色置換（関数内）

| 置換前 | 置換後 |
|---|---|
| `'background:#0d1117;'` （パネル内容div等） | `'background:'+C.bg+';'` |
| `'background:#111827;'` （カードdiv等） | `'background:'+C.bg2+';'` |
| `'border:1px solid #1e2a38;'` | `'border:1px solid '+C.bdr+';'` |
| `'color:#cfd8dc;'` | `'color:'+C.text+';'` |
| `'color:#eceff1;'` | `'color:'+C.hi+';'` |
| `'color:#607d8b;'` | `'color:'+C.lbl+';'` |
| `'color:#546e7a;'` | `'color:'+C.dim+';'` |
| `'color:#4fc3f7;'` | `'color:'+C.acc+';'` |
| `'background:#0d1117;border:1px solid #1e2a38;border-radius:4px;color:#eceff1;'` （input系） | `'background:'+C.bg+';border:1px solid '+C.bdr+';border-radius:4px;color:'+C.hi+';'` |

---

## Step 6: `renderCurfewPanel()` をDay mode対応化

### 6-1. 関数先頭に追加

```javascript
  var C = getDayColors();
```

### 6-2. `inStyle` 変数の置換

現在:
```javascript
  var inStyle = 'background:#0d1117;border:1px solid #1e2a38;border-radius:4px;' +
                'color:#eceff1;font-size:22px;padding:8px 12px;width:100%;box-sizing:border-box;' +
                'text-align:center;outline:none;';
```

変更後:
```javascript
  var inStyle = 'background:'+C.bg+';border:1px solid '+C.bdr+';border-radius:4px;' +
                'color:'+C.hi+';font-size:22px;padding:8px 12px;width:100%;box-sizing:border-box;' +
                'text-align:center;outline:none;';
```

### 6-3. panel.innerHTML 内の色置換

| 置換前 | 置換後 |
|---|---|
| `'border:1px solid #1e2a38;border-radius:8px;padding:20px;margin-bottom:16px;'` | `'border:1px solid '+C.bdr+';border-radius:8px;padding:20px;margin-bottom:16px;'` |
| `'border:1px solid #1e2a38;border-radius:8px;padding:20px;min-height:100px;'` | `'border:1px solid '+C.bdr+';border-radius:8px;padding:20px;min-height:100px;'` |
| `'color:#4fc3f7;font-size:11px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:16px;'` | `'color:'+C.acc+';font-size:11px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:16px;'` |
| `'color:#4fc3f7;font-size:11px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:14px;'` | `'color:'+C.acc+';font-size:11px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:14px;'` |
| `'color:#cfd8dc;font-size:14px;font-weight:bold;margin-bottom:8px;'` | `'color:'+C.text+';font-size:14px;font-weight:bold;margin-bottom:8px;'` |
| `'color:#cfd8dc;font-size:24px;font-weight:bold;'` | `'color:'+C.text+';font-size:24px;font-weight:bold;'` |
| `'color:#546e7a;font-size:11px;margin-top:6px;'` | `'color:'+C.dim+';font-size:11px;margin-top:6px;'` |
| `'color:#546e7a;font-size:12px;margin-bottom:8px;'` | `'color:'+C.dim+';font-size:12px;margin-bottom:8px;'` |
| `'color:#546e7a;font-size:11px;margin-top:4px;text-align:center;'` | `'color:'+C.dim+';font-size:11px;margin-top:4px;text-align:center;'` |
| `'color:#90a4ae;font-size:12px;margin-bottom:6px;'` | `'color:'+C.lbl+';font-size:12px;margin-bottom:6px;'` |
| `'font-size:40px;font-weight:bold;color:#eceff1;letter-spacing:.05em;'` | `'font-size:40px;font-weight:bold;color:'+C.hi+';letter-spacing:.05em;'` |
| `'color:#546e7a;font-size:12px;margin-top:6px;'` | `'color:'+C.dim+';font-size:12px;margin-top:6px;'` |
| `'color:#546e7a;font-size:11px;margin-top:16px;text-align:center;'` | `'color:'+C.dim+';font-size:11px;margin-top:16px;text-align:center;'` |

---

## Step 7: `renderCcBrfgPanel()` をDay mode対応化

### 7-1. 関数先頭に追加

```javascript
  var C = getDayColors();
```

### 7-2. panel.innerHTML 内の色置換

| 置換前 | 置換後 |
|---|---|
| `style="background:transparent;border:none;border-bottom:1px solid #1e2a38;color:#cfd8dc;` | `style="background:transparent;border:none;border-bottom:1px solid '+C.bdr+';color:'+C.text+';` |
| `'color:#cfd8dc;font-size:13px;line-height:1.8;` （乱気流テキスト） | `'color:'+C.text+';font-size:13px;line-height:1.8;` |
| `color:#607d8b` （テーブル内 td ラベル） | `color:'+C.lbl+'` |
| `color:#eceff1` （テーブル内 td 値） | `color:'+C.hi+'` |
| `'color:#607d8b;font-size:10px;text-transform:uppercase;` | `'color:'+C.lbl+';font-size:10px;text-transform:uppercase;` |

### 7-3. `renderTurbulenceChart()` をDay mode対応化

`renderTurbulenceChart(canvas, turbData)` 関数内:

先頭に追加:
```javascript
  var C = getDayColors();
```

色の置換:

| 置換前 | 置換後 |
|---|---|
| `ctx.fillStyle = '#080c14';` | `ctx.fillStyle = C.cBg;` |
| `ctx.strokeStyle = 'rgba(255,255,255,0.1)';` | `ctx.strokeStyle = C.cGrid;` |
| `ctx.strokeStyle = 'rgba(255,255,255,0.07)';` | `ctx.strokeStyle = C.cGrid;` |
| `ctx.fillStyle = '#607d8b';` | `ctx.fillStyle = C.lbl;` |
| `ctx.strokeStyle = '#ffffff';` （飛行プロファイル） | `ctx.strokeStyle = C.cLine;` |
| `ctx.fillStyle = '#4fc3f7';` （出発・到着ラベル） | `ctx.fillStyle = C.acc;` |
| レジェンドテキスト `ctx.fillStyle = '#cfd8dc';` | `ctx.fillStyle = C.text;` |

---

## 確認事項

- Holding panel を開いた状態で Day/Night 切り替え → テーブルが正しく再描画される
- Taiwan を選択 → Day mode でも読みやすい
- Curfew panel: 大きな数字（40px）が Day mode で黒字で読める
- CC BRFG の Canvas: Day mode で背景が白に、飛行プロファイルが濃色になる
- Dump panel: 機材名・Toremain・現在燃料入力欄が読める
