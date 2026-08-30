# 修正指示書: WX 発雷タブ新設

**ES5 厳守 (var / function のみ)。既存ロジックは変更しないこと。**

---

## 概要

WX ページに **発雷** タブを新設し、tono2.net/weather/ の「VII. 発雷確率」セクションを完全移設する。

### データソース

```
https://www.tono2.net/weather/light_{area}_{step}.png
```

| パラメータ | 値 |
|-----------|-----|
| area | `jp`（本州域）/ `sjp`（南日本域） |
| step | `00`=実況, `01`=+3h, `02`=+6h, `03`=+9h, `04`=+12h, `05`=+15h, `06`=+18h |

- 画像は `<img>` 直リンクで取得（プロキシ不要、CORS 不要）
- キャッシュ防止: URL に `?v=` + `Date.now()` を付加

---

## 修正 1: WX タブボタンに「発雷」を追加

WX ページのタブボタン生成箇所（METAR・SKEWT 等が並ぶ行）を探し、
既存タブの末尾に「発雷」ボタンを追加する。

既存の WX タブボタン例：
```html
<button onclick="wxShowTab('metar')">METAR/TAF</button>
<button onclick="wxShowTab('skewt')">SKEW-T</button>
```

追加するボタン（実際の onclick 形式・スタイルに合わせること）：
```html
<button onclick="wxShowTab('hatsurai')">発雷</button>
```

---

## 修正 2: 発雷セクション HTML を追加

既存 WX セクション（`id="wx-sec-metar"` 等）の直後に追加する。

```html
<div id="wx-sec-hatsurai" style="display:none;">

  <!-- セクションタイトル -->
  <div style="font-size:12px;font-weight:bold;color:#333;margin:6px 0 4px;
              border-bottom:1px solid #ccc;padding-bottom:2px;">
    ⚡ 発雷確率
  </div>

  <!-- エリア選択 -->
  <div style="margin-bottom:6px;">
    <span style="font-size:11px;color:#555;margin-right:4px;">エリア:</span>
    <button id="wx-light-btn-jp"
            onclick="wxLightSetArea('jp')"
            style="font-size:11px;padding:2px 8px;margin-right:4px;
                   background:#2a6ebb;color:#fff;border:none;border-radius:3px;cursor:pointer;">
      本州域
    </button>
    <button id="wx-light-btn-sjp"
            onclick="wxLightSetArea('sjp')"
            style="font-size:11px;padding:2px 8px;
                   background:#eee;color:#333;border:1px solid #ccc;border-radius:3px;cursor:pointer;">
      南日本域
    </button>
  </div>

  <!-- ステップナビゲーション -->
  <div style="margin-bottom:6px;display:flex;align-items:center;gap:6px;">
    <button onclick="wxLightMove(-1)"
            style="font-size:11px;padding:2px 8px;background:#555;color:#fff;
                   border:none;border-radius:3px;cursor:pointer;">
      ◀ 前
    </button>
    <span id="wx-light-label"
          style="font-size:11px;color:#333;font-weight:bold;min-width:80px;text-align:center;">
      実況
    </span>
    <button onclick="wxLightMove(1)"
            style="font-size:11px;padding:2px 8px;background:#555;color:#fff;
                   border:none;border-radius:3px;cursor:pointer;">
      次 ▶
    </button>
  </div>

  <!-- 画像表示エリア -->
  <div id="wx-light-img-box" style="text-align:center;">
    <img id="wx-light-img"
         src=""
         alt="発雷確率"
         style="max-width:100%;border:1px solid #ccc;border-radius:3px;"
         onerror="this.alt='画像読込エラー';" />
  </div>

</div>
```

---

## 修正 3: 発雷制御スクリプトを追加

既存 WX JavaScript（`wxShowTab` 等）の近くに以下を追加する。

```javascript
/* ==================== WX 発雷 ==================== */

var WX_LIGHT_AREAS = [
  { code: 'jp',  label: '本州域'  },
  { code: 'sjp', label: '南日本域' }
];

var WX_LIGHT_STEPS = [
  { step: '00', label: '実況'    },
  { step: '01', label: '+3h予想' },
  { step: '02', label: '+6h予想' },
  { step: '03', label: '+9h予想' },
  { step: '04', label: '+12h予想' },
  { step: '05', label: '+15h予想' },
  { step: '06', label: '+18h予想' }
];

var wxLightArea = 'jp';
var wxLightStep = 0;

function wxLightUpdate() {
  var stepObj = WX_LIGHT_STEPS[wxLightStep];
  var img     = document.getElementById('wx-light-img');
  var lbl     = document.getElementById('wx-light-label');
  if (!img || !stepObj) { return; }

  var ts  = new Date().getTime();
  img.src = 'https://www.tono2.net/weather/light_' + wxLightArea + '_' + stepObj.step + '.png?v=' + ts;
  if (lbl) { lbl.textContent = stepObj.label; }

  // エリアボタンのスタイル更新
  for (var i = 0; i < WX_LIGHT_AREAS.length; i++) {
    var aBtn = document.getElementById('wx-light-btn-' + WX_LIGHT_AREAS[i].code);
    if (!aBtn) { continue; }
    if (WX_LIGHT_AREAS[i].code === wxLightArea) {
      aBtn.style.background = '#2a6ebb';
      aBtn.style.color      = '#fff';
      aBtn.style.border     = 'none';
    } else {
      aBtn.style.background = '#eee';
      aBtn.style.color      = '#333';
      aBtn.style.border     = '1px solid #ccc';
    }
  }
}

function wxLightSetArea(area) {
  wxLightArea = area;
  wxLightUpdate();
}

function wxLightMove(dir) {
  var next = wxLightStep + dir;
  if (next < 0) { next = 0; }
  if (next >= WX_LIGHT_STEPS.length) { next = WX_LIGHT_STEPS.length - 1; }
  wxLightStep = next;
  wxLightUpdate();
}

function wxLightInit() {
  wxLightArea = 'jp';
  wxLightStep = 0;
  wxLightUpdate();
}
/* ==================== /WX 発雷 ==================== */
```

---

## 修正 4: wxShowTab に発雷タブを追加

既存の `wxShowTab` 関数（WX タブ切り替え処理）を特定し、
`'hatsurai'` を受け取ったときに発雷セクションを表示するよう追記する。

```javascript
// wxShowTab 内、セクション表示の分岐に追加:
if (tab === 'hatsurai') {
  wxLightInit();
}
```

既存の `wxShowTab` が全セクションを `display:none` にしてから選択タブだけ
`display:block` にするパターンの場合は、`'wx-sec-hatsurai'` が
その対象リストに含まれていることを確認すること。

---

## まとめ（Cursor への指示）

```
fix_wx_hatsurai.md の指示に従って index.html を修正してください。

【必須】
1. WX タブボタンに「発雷」を追加
2. id="wx-sec-hatsurai" のセクション HTML を追加
   - エリアボタン: 本州域 (jp) / 南日本域 (sjp)
   - ステップナビ: ◀ 前 / ラベル / 次 ▶
   - 画像: <img id="wx-light-img">
3. WX_LIGHT_AREAS / WX_LIGHT_STEPS / wxLightUpdate / wxLightSetArea /
   wxLightMove / wxLightInit 関数を追加
4. wxShowTab に 'hatsurai' ケースを追加し wxLightInit() を呼ぶ

【画像 URL】
https://www.tono2.net/weather/light_{area}_{step}.png?v={Date.now()}
area: jp / sjp
step: 00 〜 06 (00=実況, 01=+3h, ..., 06=+18h)

ES5 厳守（var / function のみ）。他タブのロジックは変更しないこと。
```
