# 指示書：Time to Dump 計算機（修正版）

対象ファイル: `index.html`
ES5厳守（var, function宣言, 文字列連結のみ）

---

## 機材コードの正しい対応

JetPlan 内部コードの **プレフィックス** で機材を判定する。
サフィックス（A / C / K 等）はエンジン種別を示し、機体型式には関係しない。

| プレフィックス | 機体型式 | 例 |
|---|---|---|
| NH8* | B787-8 | NH8A, NH8C |
| NH9* | B787-9 | NH9A, NH9C, NH9K |
| NHX* | B787-10 | NHXK, NHXA |
| NH7* | B767（ダンプ不可） | NH7E, NH7K |

B787-10 のメインタンク容量は B787-9 と同値（78,384 lbs）。

---

## ⚠ 既実装コードへの修正指示

以下の修正は **既に index.html に実装済みのコード** を変更するもの。

---

### 修正 1: `DUMP_PARAMS` オブジェクトを削除し `getDumpParams()` 関数に置換

#### 削除する既存コード

```javascript
var DUMP_PARAMS = {
  'NH8A': { name: 'B787-8',     mainCapLbs: 79094,  centerRate: 3000, mainRate: 1250, canDump: true  },
  'NH8C': { name: 'B787-9',     mainCapLbs: 78384,  centerRate: 3000, mainRate: 1250, canDump: true  },
  'NH9K': { name: 'B777-300ER', mainCapLbs: 199000, centerRate: 4500, mainRate: 2300, canDump: true  },
  'NHXK': { name: 'B777-300ER', mainCapLbs: 199000, centerRate: 4500, mainRate: 2300, canDump: true  },
  'NH9D': { name: 'B777-200',   mainCapLbs: 148000, centerRate: 4500, mainRate: 2300, canDump: true  },
  'NH7E': { name: 'B767',       mainCapLbs: 0,      centerRate: 0,    mainRate: 0,    canDump: false },
  'NH7K': { name: 'B767',       mainCapLbs: 0,      centerRate: 0,    mainRate: 0,    canDump: false }
};
// ※ B777のレートは暫定値。実機マニュアルで要確認。
```

#### 置換後のコード（同じ場所に）

```javascript
// JetPlan コードのプレフィックスで機材を判定
// サフィックス(A/C/K等)はエンジン種別のため無視する
function getDumpParams(acftCode) {
  if(!acftCode) return null;
  if(/^NH8/.test(acftCode)) return { name: 'B787-8',  mainCapLbs: 79094, centerRate: 3000, mainRate: 1250, canDump: true  };
  if(/^NH9/.test(acftCode)) return { name: 'B787-9',  mainCapLbs: 78384, centerRate: 3000, mainRate: 1250, canDump: true  };
  if(/^NHX/.test(acftCode)) return { name: 'B787-10', mainCapLbs: 78384, centerRate: 3000, mainRate: 1250, canDump: true  };
  if(/^NH7/.test(acftCode)) return { name: 'B767',    mainCapLbs: 0,     centerRate: 0,    mainRate: 0,    canDump: false };
  return null;
}
```

---

### 修正 2: `NAV_ACFT_CODE` のパース正規表現を修正

#### 変更前（NAVLOGパース内）

```javascript
  var acftM = txt.match(/\b(NH8A|NH8C|NH9K|NH9D|NHXK|NH7E|NH7K|NH7L|NH7S|NHTR)\b/);
  NAV_ACFT_CODE = acftM ? acftM[1] : null;
```

#### 変更後

```javascript
  // NH8*/NH9*/NHX*/NH7* の4文字コードを汎用的にキャプチャ
  var acftM = txt.match(/\b(NH[0-9X][A-Z])\b/);
  NAV_ACFT_CODE = acftM ? acftM[1] : null;
```

---

### 修正 3: `renderDumpPanel()` 内の DUMP_PARAMS 参照を置換

#### 変更前

```javascript
  var params = NAV_ACFT_CODE ? DUMP_PARAMS[NAV_ACFT_CODE] : null;
```

#### 変更後

```javascript
  var params = getDumpParams(NAV_ACFT_CODE);
```

---

### 修正 4: `onDumpCurInput()` 内の DUMP_PARAMS 参照を置換

#### 変更前

```javascript
  var params = NAV_ACFT_CODE ? DUMP_PARAMS[NAV_ACFT_CODE] : null;
```

#### 変更後

```javascript
  var params = getDumpParams(NAV_ACFT_CODE);
```

---

## 新規実装（未実装の場合）

以下は修正 1〜4 が未実装の場合のみ適用する。

---

## 完成イメージ

```
┌─────────────────────────────────────────────────────────────────┐
│ Time to Dump                          [フライトプランから更新]   │
│                                                                  │
│ MLW目標燃料（TO REMAIN）までのジェティソン所要時間を推定します。 │
│                                                                  │
│ ┌─ FLIGHT PLAN DATA ─────────────────────────────────────────┐  │
│ │ 機材: B787-8               MLDW: 380,000 lbs              │  │
│ │ TO REMAIN (MLW燃料): 67,700 lbs    ZFW: 312,300 lbs       │  │
│ │ 離陸時燃料: 96,600 lbs                                      │  │
│ └────────────────────────────────────────────────────────────┘  │
│ ※ メインタンク容量（B787-8）: 79,094 lbs                        │
│                                                                  │
│ ┌─ 離陸時燃料ベース ──────┐  ┌─ 現在燃料入力 ────────────────┐  │
│ │   12.9 min              │  │ [入力欄]                      │  │
│ │ ダンプ量: 28,900 lbs    │  │                               │  │
│ └─────────────────────────┘  └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## グローバル変数の追加（未追加の場合）

```javascript
var NAV_PZFW_LBS = null;    // Planned Zero Fuel Weight (lbs)
var NAV_ACFT_CODE = null;   // JetPlan 機材コード (例: 'NH8A')
var NAV_TAX_LBS  = null;    // TAX燃料 (lbs)
```

---

## NAVLOGパースに追加（未追加の場合）

```javascript
  // PZFW
  var pzfwM = txt.match(/PZFW\s+(\d+)/);
  NAV_PZFW_LBS = pzfwM ? parseInt(pzfwM[1], 10) : null;

  // 機材コード: NH8*/NH9*/NHX*/NH7* の4文字コード
  var acftM = txt.match(/\b(NH[0-9X][A-Z])\b/);
  NAV_ACFT_CODE = acftM ? acftM[1] : null;

  // TAX燃料 (6桁数値)
  var taxFuelM = txt.match(/^TAX\s+(\d{6})/m);
  NAV_TAX_LBS = taxFuelM ? parseInt(taxFuelM[1], 10) : null;
```

---

## clearFpl() に追加（未追加の場合）

```javascript
  NAV_PZFW_LBS = null; NAV_ACFT_CODE = null; NAV_TAX_LBS = null;
  if(typeof renderDumpPanel === 'function') renderDumpPanel();
```

---

## ダンプ計算・描画関数（未実装の場合）

`renderCcBrfgPanel` の直前に挿入:

```javascript
// ── Time to Dump ────────────────────────────────────────────────

function calcDumpTime(fobLbs, toRemainLbs, params) {
  var dumpLbs = fobLbs - toRemainLbs;
  if(dumpLbs <= 0) return { dumpLbs: 0, totalMin: 0, afterLbs: fobLbs, centerLbs: 0, mainLbs: 0 };

  var centerAvail = Math.max(0, fobLbs - params.mainCapLbs);
  var centerDump  = Math.min(centerAvail, dumpLbs);
  var mainDump    = Math.max(0, dumpLbs - centerDump);

  var centerMin = params.centerRate > 0 ? centerDump / params.centerRate : 0;
  var mainMin   = params.mainRate   > 0 ? mainDump   / params.mainRate   : 0;
  var totalMin  = centerMin + mainMin;

  return {
    dumpLbs:   Math.round(dumpLbs),
    centerLbs: Math.round(centerDump),
    mainLbs:   Math.round(mainDump),
    centerMin: centerMin,
    mainMin:   mainMin,
    totalMin:  totalMin,
    afterLbs:  Math.round(fobLbs - dumpLbs)
  };
}

function renderDumpResult(containerId, fobLbs, toRemainLbs, params, label) {
  var el = document.getElementById(containerId);
  if(!el) return;

  if(fobLbs === null || toRemainLbs === null || !params) {
    el.innerHTML = '<div style="color:#607d8b;">—</div>'; return;
  }

  var C = getDayColors();
  var gw = NAV_PZFW_LBS !== null ? NAV_PZFW_LBS + fobLbs : null;
  var dumpNeeded = fobLbs > toRemainLbs;
  var res = dumpNeeded ? calcDumpTime(fobLbs, toRemainLbs, params) : null;

  var aboveLbs = gw !== null && NAV_MLDW !== null ? Math.round(gw - NAV_MLDW * 1000) : null;
  var aboveStr = (aboveLbs !== null && aboveLbs > 0)
    ? '<span style="color:#ff9800;">' + aboveLbs.toLocaleString() + ' lbs above MLDW</span>'
    : '<span style="color:#66bb6a;">MLDW以下 — ダンプ不要</span>';

  var html =
    '<div style="font-size:12px;color:'+C.lbl+';margin-bottom:6px;">' + label + '</div>' +
    '<div style="color:'+C.text+';font-size:13px;line-height:1.9;">' +
      'Fuel on board: ' + fobLbs.toLocaleString() + ' lbs<br>' +
      (gw !== null ? '総重量: ' + gw.toLocaleString() + ' lbs (' + aboveStr + ')<br>' : '') +
      'TO REMAIN: ' + toRemainLbs.toLocaleString() + ' lbs' +
    '</div>';

  if(!dumpNeeded) {
    html += '<div style="font-size:28px;font-weight:bold;color:#66bb6a;margin:12px 0;">ダンプ不要</div>';
  } else if(res) {
    html +=
      '<div style="font-size:32px;font-weight:bold;color:'+C.hi+';margin:12px 0;">' +
        res.totalMin.toFixed(1) + ' min' +
      '</div>' +
      '<div style="color:'+C.lbl+';font-size:12px;line-height:1.8;">' +
        'ダンプ量: ' + res.dumpLbs.toLocaleString() + ' lbs<br>' +
        'ダンプ後残燃料: ' + res.afterLbs.toLocaleString() + ' lbs<br>' +
        (res.centerLbs > 0
          ? 'セ ' + res.centerLbs.toLocaleString() + ' @3,000lbs/min'
            + (res.mainLbs > 0 ? '、メ ' + res.mainLbs.toLocaleString() + ' @1,250lbs/min' : '')
          : 'メイン ' + res.mainLbs.toLocaleString() + ' @1,250lbs/min') +
      '</div>';
  }

  el.innerHTML = html;
}

function renderDumpPanel() {
  var panel = document.getElementById('dump-panel');
  if(!panel) return;

  var C = getDayColors();
  var params = getDumpParams(NAV_ACFT_CODE);
  var acftName = params ? params.name : (NAV_ACFT_CODE || '—');
  var toRemainLbs = (NAV_MLDW !== null && NAV_PZFW_LBS !== null)
    ? Math.round(NAV_MLDW * 1000 - NAV_PZFW_LBS) : null;

  var taxiLbs = NAV_TAX_LBS !== null ? NAV_TAX_LBS
    : (NAV_TAXI_MIN !== null ? Math.round(NAV_TAXI_MIN * 150) : 0);
  var fobTakeoffLbs = (NAV_FOB_LBS !== null)
    ? NAV_FOB_LBS - taxiLbs : null;

  var noDump   = params && !params.canDump;
  var notReady = !NAV_DEP && !NAV_DEST;

  panel.innerHTML =
    '<div class="bar">' +
      '<span style="color:'+C.acc+';font-weight:bold;letter-spacing:.08em;">Time to Dump</span>' +
      '<button class="btn" onclick="renderDumpPanel()" style="margin-left:auto;" title="フライトプランから再計算">↺ フライトプランから更新</button>' +
    '</div>' +
    '<div style="padding:16px 18px;overflow-y:auto;height:calc(100% - 44px);box-sizing:border-box;">' +

      '<div style="color:'+C.lbl+';font-size:12px;line-height:1.7;margin-bottom:16px;">' +
        'MLW目標燃料（TO REMAIN）までのジェティソン所要時間を推定します。まずセンタータンクからダンプし、続いてメインタンクを調整します。' +
        'EICASシノプティックの流量目安: センタータンク 約3,000lbs/min、メインのみ 約1,250lbs/min。' +
        'プランニング用推定値。実ダンプ時間はFuel Synopticに表示されます。' +
      '</div>' +

      '<div style="border:1px solid '+C.bdr+';border-radius:6px;padding:14px;margin-bottom:14px;">' +
        '<div style="color:'+C.lbl+';font-size:10px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px;">FLIGHT PLAN DATA</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;color:'+C.text+';">' +
          '<div><span style="color:'+C.lbl+';font-size:11px;">機材</span><br><strong>' + acftName + '</strong></div>' +
          '<div><span style="color:'+C.lbl+';font-size:11px;">MLDW</span><br><strong>' +
            (NAV_MLDW !== null ? (NAV_MLDW * 1000).toLocaleString() + ' lbs' : '—') + '</strong></div>' +
          '<div><span style="color:'+C.lbl+';font-size:11px;">TO REMAIN (MLW燃料)</span><br><strong>' +
            (toRemainLbs !== null ? toRemainLbs.toLocaleString() + ' lbs' : '—') + '</strong></div>' +
          '<div><span style="color:'+C.lbl+';font-size:11px;">ZFW</span><br><strong>' +
            (NAV_PZFW_LBS !== null ? NAV_PZFW_LBS.toLocaleString() + ' lbs' : '—') + '</strong></div>' +
          '<div><span style="color:'+C.lbl+';font-size:11px;">離陸時燃料</span><br><strong>' +
            (fobTakeoffLbs !== null ? fobTakeoffLbs.toLocaleString() + ' lbs' : '—') + '</strong>' +
            (NAV_FOB_LBS !== null && taxiLbs > 0
              ? '<div style="font-size:10px;color:'+C.dim+';">FOB ' + NAV_FOB_LBS.toLocaleString() +
                ' − TAX ' + taxiLbs.toLocaleString() + ' lbs</div>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +

      (params && params.mainCapLbs > 0
        ? '<div style="color:'+C.dim+';font-size:11px;margin-bottom:14px;">※ メインタンク容量（' +
          params.name + '）: ' + params.mainCapLbs.toLocaleString() + ' lbs</div>' : '') +

      (noDump
        ? '<div style="color:#ff9800;font-size:13px;padding:12px;background:rgba(255,152,0,.1);border-radius:6px;">' +
          '⚠ この機材（' + acftName + '）は燃料ダンプシステムを装備していません。</div>'
        : '') +

      (!noDump
        ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">' +

          '<div style="border:1px solid '+C.bdr+';border-radius:6px;padding:14px;">' +
            '<div style="color:'+C.lbl+';font-size:10px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">離陸時燃料ベース</div>' +
            '<div id="dump-result-tof"></div>' +
          '</div>' +

          '<div style="border:1px solid '+C.bdr+';border-radius:6px;padding:14px;">' +
            '<div style="color:'+C.lbl+';font-size:10px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">現在燃料入力</div>' +
            '<input id="dump-cur-input" type="text" placeholder="例: 52.4 または 52400"' +
              ' style="width:100%;background:'+C.bg+';border:1px solid '+C.bdr+';border-radius:4px;' +
              'color:'+C.text+';font-size:13px;padding:6px 8px;box-sizing:border-box;outline:none;"' +
              ' oninput="onDumpCurInput(this.value)">' +
            '<div style="color:'+C.dim+';font-size:11px;margin:6px 0 12px 0;">' +
              'MLDWを超えている場合の現在残燃料を入力。千単位（52.4）またはlbs（52400）どちらも可。' +
            '</div>' +
            '<div style="color:'+C.lbl+';font-size:10px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">現在燃料ベース</div>' +
            '<div id="dump-result-cur"><div style="color:'+C.lbl+';">燃料を入力してください。</div></div>' +
          '</div>' +

        '</div>'
        : '') +

    '</div>';

  if(!noDump && params && fobTakeoffLbs !== null && toRemainLbs !== null) {
    renderDumpResult('dump-result-tof', fobTakeoffLbs, toRemainLbs, params, 'AT TAKE-OFF FUEL');
  }
}

function onDumpCurInput(val) {
  var params = getDumpParams(NAV_ACFT_CODE);
  var toRemainLbs = (NAV_MLDW !== null && NAV_PZFW_LBS !== null)
    ? Math.round(NAV_MLDW * 1000 - NAV_PZFW_LBS) : null;
  var el = document.getElementById('dump-result-cur');
  if(!el) return;
  var C = getDayColors();
  if(!val || !val.trim()) {
    el.innerHTML = '<div style="color:'+C.lbl+';">燃料を入力してください。</div>';
    return;
  }
  var num = parseFloat(val.replace(/,/g, ''));
  if(isNaN(num)) { el.innerHTML = '<div style="color:#ef5350;">無効な値です。</div>'; return; }
  var lbs = num < 1000 ? Math.round(num * 1000) : Math.round(num);
  renderDumpResult('dump-result-cur', lbs, toRemainLbs, params, '現在燃料ベース');
}
```

---

## showTab() に dump を追加（未追加の場合）

```javascript
  ['wx','fp','atm','atm-gfs','crew-rest','fdp','memo','ccbrfg','dump','curfew','holding'].forEach(function(n) {
```

---

## NAVLOG適用後に呼ぶ（未追加の場合）

```javascript
  if(typeof renderDumpPanel === 'function') renderDumpPanel();
```

---

## メニューボタン（未追加の場合）

```html
      <button class="nav-item" id="nav-dump" onclick="navTo('dump')">⛽ Time to Dump</button>
```

---

## dump-panel HTML（未追加の場合）

```html
<!-- ===== TIME TO DUMP ===== -->
<div id="dump-panel" class="panel">
  <!-- renderDumpPanel() によって動的生成 -->
</div>
```

---

## navTo に追加（未追加の場合）

```javascript
  if(id === 'dump') renderDumpPanel();
```

---

## 確認事項

- NH8A NAVLOG → 機材欄に「B787-8」、mainCap 79,094 lbs と表示される
- NH9K NAVLOG → 機材欄に「B787-9」、mainCap 78,384 lbs と表示される（※旧コードでは B777 と誤表示されていた）
- NHXK NAVLOG → 機材欄に「B787-10」、mainCap 78,384 lbs と表示される
- B767 系 NAVLOG → 「ダンプシステムなし」警告のみ表示
- Day mode で操作してもカード・入力欄が白背景・黒文字で読みやすい

---

## 実装順序

修正 1〜4（既実装コードの修正）→ commit → 未実装部分の追加 → commit
