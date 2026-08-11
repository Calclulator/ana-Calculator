# Cursor指示書: バグ修正 第2弾 (index.html)

ES5制約厳守 (var / function宣言 / 通常forループ / 文字列連結)。
修正A→B→Cの順に適用してコミット。

---

## 修正A: Memo — Fuel Dumpが「約0分」になる問題を修正

### 問題の真因

`onDumpCurInput()` でユーザーが「現在燃料」入力欄に値を入力すると、
`renderDumpResult('dump-result-cur', lbs, ...)` が呼ばれ、その内部で
`updateDumpTimeMinGlobal(res, dumpNeeded)` が実行される。

現在燃料が TO REMAIN（MLDW - PZFW）より僅かに多い場合（例: 20,100 lbs vs 20,000 lbs）、
`calcDumpTime` が totalMin ≈ 0.08 を返し、`DUMP_TIME_MIN = 0.08` に上書きされる。
その後 Memo を開くと `Math.round(0.08) = 0` → 「約0分」と表示される。

Dump ページ左ボックスの「AT TAKE-OFF FUEL: 47min」は別 DOM なので上書きされず、
ユーザーは 47min を見ているのに Memo が 0分と表示される。

### 変更箇所1: parse完了時の関数呼び出し順序を変更

以下を探す（parse完了処理の後半、行番号は目安）:

```javascript
  if(typeof renderMemoPanel === 'function') renderMemoPanel();
  if(typeof renderCcBrfgPanel === 'function') renderCcBrfgPanel();
  if(typeof renderDumpPanel === 'function') renderDumpPanel();
```

以下に置き換える（renderDumpPanel を先に呼ぶ）:

```javascript
  if(typeof renderDumpPanel === 'function') renderDumpPanel();
  if(typeof renderMemoPanel === 'function') renderMemoPanel();
  if(typeof renderCcBrfgPanel === 'function') renderCcBrfgPanel();
```

### 変更箇所2: `renderDumpResult` に `skipGlobal` 引数を追加

以下を探す:

```javascript
function renderDumpResult(containerId, fobLbs, toRemainLbs, params, label) {
```

以下に置き換える:

```javascript
function renderDumpResult(containerId, fobLbs, toRemainLbs, params, label, skipGlobal) {
```

同関数内の以下を探す:

```javascript
  var res = dumpNeeded ? calcDumpTime(fobLbs, toRemainLbs, params) : null;
  updateDumpTimeMinGlobal(res, dumpNeeded);
```

以下に置き換える:

```javascript
  var res = dumpNeeded ? calcDumpTime(fobLbs, toRemainLbs, params) : null;
  if(!skipGlobal) updateDumpTimeMinGlobal(res, dumpNeeded);
```

### 変更箇所3: `onDumpCurInput` 内の呼び出しに `skipGlobal=true` を追加

以下を探す（`onDumpCurInput` 関数の末尾付近）:

```javascript
  renderDumpResult('dump-result-cur', lbs, toRemainLbs, params, '現在燃料ベース');
```

以下に置き換える:

```javascript
  renderDumpResult('dump-result-cur', lbs, toRemainLbs, params, '現在燃料ベース', true);
```

**効果**:
- `DUMP_TIME_MIN` は常に AT TAKE-OFF FUEL ベースの値を保持する
- 現在燃料入力は右ボックスの表示のみを更新し、DUMP_TIME_MIN を上書きしない
- Memo の「Dump約N分」は離陸時燃料ベースの値を正しく表示する

---

## 修正B: WX Radar — Waypointが消えないよう修正（タイムアウトの安全化）

### 問題の真因

`showTab('wx')` 内の `[50, 200, 500, 1000]ms` タイムアウトは、
WX パネルに切り替えた直後に登録される。
ユーザーが 1秒以内に別パネルへ移動した場合、タイムアウトはパネルが非表示の状態で発火する。

この時 `map.invalidateSize(true)` が呼ばれると、Leaflet はマップコンテナサイズを
0×0 と計算し、全マーカーの DOM 位置を (0,0) にリセットする。
再度 WX パネルへ戻ると即時 `drawRoute()` でマーカーは再配置されるが、
残留タイムアウトが再び `invalidateSize` → 崩壊 → の繰り返しで
何度か行き来するうちにマーカーが消えたままになる。

また、前回の Fix C で追加した 1000ms での `drawRoute()` 呼び出しは
`drawAlt()` → `loadMetars()` の二重呼び出しを引き起こし、
既存の METAR サークルをクリアした後の再フェッチ完了前にユーザーがタップすると
「データなし」が表示される（修正Bでこれも同時に解消する）。

### 変更箇所: `showTab` 内のタイムアウトブロックを置き換える

以下を探す:

```javascript
    [50, 200, 500, 1000].forEach(function(delay){
      setTimeout(function(){
        if(typeof map !== 'undefined' && map) {
          try {
            map.invalidateSize(true);
          } catch(e){}
        }
        if(delay === 200 && typeof reloadSatLayer === 'function') {
          reloadSatLayer();
        }
        // 全非同期処理完了後にWaypointを再描画してbringTopで最前面へ
        if(delay === 1000) {
          if(typeof WP !== 'undefined' && WP && WP.length >= 2 && typeof drawRoute === 'function') {
            drawRoute();
          } else if(typeof bringTop === 'function') {
            bringTop();
          }
        }
      }, delay);
    });
```

以下に置き換える:

```javascript
    [50, 200, 500, 1000].forEach(function(delay){
      setTimeout(function(){
        // WXパネルが非アクティブなら全処理をスキップ
        // （非表示状態でinvalidateSizeするとLeafletがマーカー位置を0,0にリセットする）
        var wxPanelEl = document.getElementById('wx-panel');
        if(!wxPanelEl || !wxPanelEl.classList.contains('active')) return;
        if(typeof map !== 'undefined' && map) {
          try {
            map.invalidateSize(true);
          } catch(e){}
        }
        if(delay === 200 && typeof reloadSatLayer === 'function') {
          reloadSatLayer();
        }
        // 1000ms後: drawRouteは呼ばずbringTopのみ
        // drawRoute→drawAlt→loadMetarsの二重呼び出しによるMETARクリアを防ぐ
        if(delay === 1000) {
          if(typeof bringTop === 'function') bringTop();
        }
      }, delay);
    });
```

**注意**: タイムアウトブロックの直後にある即時 `drawRoute()` 呼び出し（以下）は残す:

```javascript
    // タブ復帰・再表示時に RTE / WP 名を再描画（iPad バックグラウンド破棄対策）
    if(typeof WP !== 'undefined' && WP && WP.length >= 2 && typeof drawRoute === 'function') {
      drawRoute();
    }
```

**効果**:
- パネルが非表示の間は `invalidateSize` が呼ばれずマーカー位置が保護される
- `loadMetars()` の二重呼び出しが防止され A/P METAR データが正しく表示される
- 1000ms 後の `bringTop()` でレイヤー順序が確実に最前面に整理される

---

## 修正C: WX Radar — A/Pタップで「データなし」になる問題を修正（修正Bの補完）

修正Bにより `loadMetars()` の二重呼び出しは解消されるが、
万一 METAR フェッチが完了する前にユーザーがタップした場合の
プレースホルダー表示は仕様として残る（フェッチ完了後は自動的に METAR 表示に置き換わる）。

追加変更は不要。修正Bを適用すれば修正Cの効果も得られる。

---

## コミット手順

```
git add index.html
git commit -m "fix: DumpページCUR入力でMemo Dump時間が0分になる問題修正 / WXパネル非表示時invalidateSize禁止でWaypoint消え/METAR二重フェッチ解消"
git push origin main
```
