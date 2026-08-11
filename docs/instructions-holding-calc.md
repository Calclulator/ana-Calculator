# 指示書：Holding Speed Calculator（全面改訂版）

対象ファイル: `index.html`
ES5厳守（var, function宣言, 文字列連結のみ）

---

## 概要

左メニューの Planning セクションに「✈ Holding」ボタンを追加。
FIR・現在高度を選択すると、各国のホールディング速度テーブルを表示し、
該当高度帯の行をハイライトする。

---

## テーブル種別と適用 FIR

### ① TABLE IV-1-1（ICAO DOC 8168, Volume I, Fourth Edition）
**スクリーンショットおよびAJX Calculator参照済みの確定値。**

| 高度帯 | 通常条件 | 乱気流条件 |
|---|---|---|
| ≤ 4,250 m（14,000 ft） | 425 km/h（230 kt）²<br>315 km/h（170 kt）⁴ | 520 km/h（280 kt）³<br>315 km/h（170 kt）⁴ |
| 4,250 m〜6,100 m（14,000〜20,000 ft） | 445 km/h（240 kt）⁵ | 520 km/h（280 kt）または 0.8M のいずれか小さい方³ |
| 6,100 m〜10,350 m（20,000〜34,000 ft） | 490 km/h（265 kt）⁵ | 520 km/h（280 kt）または 0.8M のいずれか小さい方³ |
| 10,350 m 超（34,000 ft 超） | 0.83 Mach | 0.83 Mach |

**脚注（IV-1-1）:**
1. Levels は高度計セッティングに応じて高度または飛行高度（FL）
2. ホールディング後に 230 kt（425 km/h）超の IAP が続く場合、同速度でのホールディングが望ましい
3. 280 kt（520 km/h / M0.8）の乱気流速度は ATC クリアランス要。ただし航空情報誌に収容可能と記載がある場合は不要
4. CAT A / B 機専用ホールディングのみ 315 km/h（170 kt）
5. 可能な限り 520 km/h（280 kt）を使用（航空路構造に関連するホールディング）

**適用 FIR（すべて IV-1-1）:**

| FIR | per-FIR 追記ノート |
|---|---|
| Australia (Brisbane / Melbourne FIR) | ・豪 CTA 内では速度制限 250 kt（ATC 指示あり除く）<br>・ホールディング速度は ICAO Doc 8168, Table IV-1-1（Cat A〜E）に従う |
| China FIR | ・ホールディングパターン中は ATC の指示に従い指定 FL・パターン内を厳守 |
| Hong Kong FIR | ・北側 FIR 境界付近では航法援助施設で位置確認を徹底すること<br>・特定の航法援助施設から良好な指示が得られない場合、位置を明確に確認するまで 4,500 ft 以下に降下しないこと<br>・ホールディングパターン参入時は、降下を開始する前に指定 FL まで到達または一致させること |
| Japan (Fukuoka FIR) | ・ホールディング手順は ICAO Doc 8168, Table IV-1-1 に準拠<br>・STAR/アプローチチャートに速度制限が公示されている場合はそちらに従う |
| Korea (Republic of Korea FIR) | ・RKSS（金浦）、RKSI（仁川）、RKPC（済州）は ICAO PANS (DOC 8168) Table IV-1-1 に従う |
| Malaysia (Kuala Lumpur / Kota Kinabalu FIR) | ・ICAO DOC 8168, Table IV-1-1 に準拠<br>・各空港の STAR/アプローチチャートに最大ホールディング速度が記載されている場合はそちら優先<br>・ATC からホールディングを指示された際、ホールディングパターンが設定されていない場合は標準ホールディングパターンを使用 |
| Philippines (Manila FIR) | ・ホールディング手順は ICAO Doc 8168, Table IV-1-1 に準拠<br>・STAR/アプローチチャートに公示された速度制限を確認すること |
| Singapore (Singapore FIR) | ・ホールディング速度は ICAO Doc 8168, Table IV-1-1 に準拠 |
| Thailand (Bangkok FIR) | ・Table "Holding Speeds ICAO Doc 8168"（Table IV-1-1）に従うこと |
| Vietnam (Hanoi / Ho Chi Minh FIR) | ・Doc 8168 — Table IV-1-1 ホールディング速度に従うこと |

---

### ② Taiwan (Taipei FIR) — 独自テーブル

AJX Calculator スクリーンショットより確認済み。ICAO PANS-OPS ベースだが FL 区分が独自。

| Levels | Air Speed (IAS) |
|---|---|
| FL140 以下 | 230 kt |
| FL140 超〜FL200（含む） | 240 kt |
| FL200 超〜FL340（含む） | 265 kt |
| FL340 超 | M 0.83 |

**Taiwan 追記ノート:**
- 乱気流・着氷等で速度増加が必要な場合：最大 280 kt または M0.8 のいずれか小さい方（ATC クリアランス要）
- Taipei FIR 内のホールディングパターンおよび計器飛行方式は ICAO PANS-OPS 手順に基づく
- 特段の指示がない限り、アウトバウンドレグは FL140 以下で 1 分以内、FL140 超で 1.5 分以内

---

### ③ United States (FAA) — FAA AIM 5-3-8

AJX Calculator スクリーンショットおよび faa.gov より確認済み。全機材共通。

| 高度（MSL） | 最大速度（KIAS） |
|---|---|
| MHA〜6,000 ft | 200 KIAS |
| 6,001〜14,000 ft | 230 KIAS |
| 14,001 ft 以上 | 265 KIAS |

**FAA 追記ノート:**
- 6,001〜14,000 ft のホールディングパターンは最大 210 KIAS に制限される場合がある（チャートにアイコンで表示）
- チャートのホールディングパターン内に括弧で速度が示されている場合（例: (175)）、ホールディングフィックス通過前にその速度以下に減速すること。遵守できない場合は ATC に通知
- USAF 飛行場は別途指示がない限り最大 310 KIAS
- Navy 飛行場は別途指示がない限り最大 230 KIAS

---

## グローバル変数・データオブジェクト

```javascript
var FIR_LIST = [
  {
    label: 'Australia (Brisbane / Melbourne FIR)', tableKey: 'ICAO_IV11',
    warnings: ['豪 CTA 内でホールディングパターンを離脱する際は 250 kt 制限（ATC 指示がある場合を除く）。'],
    notes: ['ホールディング速度は ICAO Doc 8168, Table IV-1-1（カテゴリ A〜E）に従う。']
  },
  {
    label: 'China FIR', tableKey: 'ICAO_IV11',
    warnings: [],
    notes: [
      'ホールディング速度は ICAO Doc 8168, Table IV-1-1 に従う。',
      'ホールディングパターン中は ATC の指示に従い、指定された飛行高度・パターン内を厳守すること。'
    ]
  },
  {
    label: 'Hong Kong FIR', tableKey: 'ICAO_IV11',
    warnings: [],
    notes: [
      'ホールディング速度は ICAO Doc 8168, Table IV-1-1 に従う。',
      '北側 FIR 境界付近では航法援助施設による位置確認を徹底すること。',
      '特定の航法援助施設から良好な指示が得られない場合、位置を明確に確認するまで 4,500 ft 以下に降下しないこと。',
      'ホールディングに入る際は指定 FL に到達または一致させてから降下を開始し、適切なトラフィックシーケンスを維持すること。'
    ]
  },
  {
    label: 'Japan (Fukuoka FIR)', tableKey: 'ICAO_IV11',
    warnings: [],
    notes: [
      'ホールディング手順は ICAO Doc 8168, Table IV-1-1 ホールディング速度に準拠。',
      'STAR/アプローチチャートに公示された速度制限を確認すること。'
    ]
  },
  {
    label: 'Korea (Republic of Korea FIR)', tableKey: 'ICAO_IV11',
    warnings: [],
    notes: [
      'ホールディング速度は ICAO Doc 8168, Table IV-1-1 に従う。',
      'RKSS（金浦）、RKSI（仁川）、RKPC（済州）は ICAO PANS (DOC 8168) Table IV-1-1 に従う。'
    ]
  },
  {
    label: 'Malaysia (Kuala Lumpur / Kota Kinabalu FIR)', tableKey: 'ICAO_IV11',
    warnings: ['各空港の STAR/アプローチチャートに最大ホールディング速度が記載されている場合はそちらを確認すること。'],
    notes: [
      'ICAO DOC 8168, Table IV-1-1 に準拠。',
      'ホールディングパターンが未設定の地点で ATC からホールディングを指示された場合は標準ホールディングパターンを使用。'
    ]
  },
  {
    label: 'Philippines (Manila FIR)', tableKey: 'ICAO_IV11',
    warnings: [],
    notes: [
      'ホールディング手順は ICAO Doc 8168, Table IV-1-1 ホールディング速度に準拠。',
      'STAR/アプローチチャートに公示された速度制限を確認すること。'
    ]
  },
  {
    label: 'Singapore (Singapore FIR)', tableKey: 'ICAO_IV11',
    warnings: [],
    notes: ['ホールディング速度は ICAO Doc 8168, Table IV-1-1 に準拠。']
  },
  {
    label: 'Taiwan (Taipei FIR)', tableKey: 'TAIWAN',
    warnings: ['乱気流・着氷等による速度増加が必要な場合：最大 280 kt または M0.8 のいずれか小さい方。ATC クリアランス要。'],
    notes: [
      'Taipei FIR 内のホールディングパターンおよび計器飛行方式は ICAO PANS-OPS 手順に基づく。',
      '特段の指示がない限り、アウトバウンドレグは FL140 以下で 1 分以内、FL140 超で 1.5 分以内。'
    ]
  },
  {
    label: 'Thailand (Bangkok FIR)', tableKey: 'ICAO_IV11',
    warnings: [],
    notes: ['Table "Holding Speeds ICAO Doc 8168"（Table IV-1-1）に従うこと。']
  },
  {
    label: 'United States (FAA)', tableKey: 'FAA',
    warnings: [],
    notes: [
      'FAA AIM 5-3-8, TBL 5-3-24 に基づく最大ホールディング速度（全機材共通）。',
      '6,001〜14,000 ft のホールディングパターンは最大 210 KIAS に制限される場合がある（チャートにアイコンで表示）。',
      'チャートのホールディング内に括弧で速度が示されている場合（例: (175)）、ホールディングフィックス通過前にその速度以下に減速。遵守できない場合は ATC に通知。',
      'USAF 飛行場：別途指示なければ最大 310 KIAS。Navy 飛行場：別途指示なければ最大 230 KIAS。'
    ]
  },
  {
    label: 'Vietnam (Hanoi / Ho Chi Minh FIR)', tableKey: 'ICAO_IV11',
    warnings: ['280 kt（520 km/h / M0.8）の乱気流速度は ATC の事前承認がある場合のみ適用可。'],
    notes: ['Doc 8168 — Table IV-1-1 ホールディング速度に従うこと。']
  }
];

var HOLDING_DATA = {

  'ICAO_IV11': {
    tableTitle: 'TABLE IV-1-1 — HOLDING SPEEDS (ICAO DOC 8168, VOLUME I, FOURTH EDITION — FLIGHT PROCEDURES)',
    type: 'icao',
    levels: [
      {
        labelEN: 'Up to 4250 m (14,000 ft) inclusive',
        maxFt: 14000,
        normalHTML: '425 km/h (230 kt)<sup>2</sup><br><span style="color:#78909c;font-size:11px;">315 km/h (170 kt)<sup>4</sup></span>',
        turbHTML:   '520 km/h (280 kt)<sup>3</sup><br><span style="color:#78909c;font-size:11px;">315 km/h (170 kt)<sup>4</sup></span>'
      },
      {
        labelEN: 'Above 4250 m to 6100 m inclusive (14,000 ft to 20,000 ft)',
        maxFt: 20000,
        normalHTML: '445 km/h (240 kt)<sup>5</sup>',
        turbHTML:   '520 km/h (280 kt) or 0.8 Mach, whichever is less<sup>3</sup>'
      },
      {
        labelEN: 'Above 6100 m to 10,350 m inclusive (20,000 ft to 34,000 ft)',
        maxFt: 34000,
        normalHTML: '490 km/h (265 kt)<sup>5</sup>',
        turbHTML:   '520 km/h (280 kt) or 0.8 Mach, whichever is less<sup>3</sup>'
      },
      {
        labelEN: 'Above 10,350 m (34,000 ft)',
        maxFt: 999999,
        normalHTML: '0.83 Mach',
        turbHTML:   '0.83 Mach'
      }
    ],
    footnotes: [
      '<sup>1</sup> Levels are altitudes or corresponding flight levels depending on the altimeter setting in use.',
      '<sup>2</sup> If a holding procedure is followed by an initial segment of an instrument approach promulgated at a speed higher than 230 kt (425 km/h), the holding should also use that higher speed where possible.',
      '<sup>3</sup> Turbulence speeds of 520 km/h (280 kt / M0.8) require prior clearance from ATC, unless publications state the holding area can accommodate it.',
      '<sup>4</sup> 315 km/h (170 kt) for holdings limited to CAT A and B aircraft only.',
      '<sup>5</sup> Wherever possible, 520 km/h (280 kt) should be used for holding procedures associated with airway route structures.'
    ]
  },

  'TAIWAN': {
    tableTitle: 'HOLDING SPEEDS — LEVELS AND AIR SPEED (IAS) (Taiwan / Taipei FIR)',
    type: 'taiwan',
    levels: [
      { labelEN: 'FL140 and below',                  maxFt: 14000,  speedHTML: '230 kt' },
      { labelEN: 'Above FL140 to FL200 (inclusive)', maxFt: 20000,  speedHTML: '240 kt' },
      { labelEN: 'Above FL200 to FL340 (inclusive)', maxFt: 34000,  speedHTML: '265 kt' },
      { labelEN: 'Above FL340 (inclusive)',           maxFt: 999999, speedHTML: 'M 0.83' }
    ],
    footnotes: []
  },

  'FAA': {
    tableTitle: 'TABLE IV-1-2 — HOLDING SPEEDS PER U.S. FAA REGULATIONS',
    type: 'faa',
    levels: [
      { labelEN: 'MHA to 6000 ft',        maxFt: 6000,   faaKt: 200 },
      { labelEN: '6001 ft to 14,000 ft',  maxFt: 14000,  faaKt: 230 },
      { labelEN: '14,001 ft and above',   maxFt: 999999, faaKt: 265 }
    ],
    footnotes: []
  }

};
```

---

## Step 1: showTab() に holding を追加

```javascript
  ['wx','fp','atm','atm-gfs','crew-rest','fdp','memo','ccbrfg','dump','curfew','holding'].forEach(function(n) {
```

---

## Step 2: renderHoldingPanel() と updateHoldingTable() の追加

`renderCurfewPanel` 関数の直前に挿入:

```javascript
// ── Holding Speed Calculator ─────────────────────────────────────

function renderHoldingPanel() {
  var panel = document.getElementById('holding-panel');
  if(!panel) return;

  // FIR プルダウン生成（value は FIR_LIST インデックス）
  var defaultIdx = 3; // Japan (Fukuoka FIR)
  var firOpts = '';
  for(var fi = 0; fi < FIR_LIST.length; fi++) {
    firOpts += '<option value="' + fi + '"' +
      (fi === defaultIdx ? ' selected' : '') + '>' + FIR_LIST[fi].label + '</option>';
  }

  var selStyle = 'background:#0d1117;border:1px solid #1e2a38;border-radius:4px;' +
                 'color:#cfd8dc;font-size:13px;padding:6px 10px;width:100%;outline:none;';
  var inStyle  = 'background:#0d1117;border:1px solid #1e2a38;border-radius:4px;' +
                 'color:#cfd8dc;font-size:13px;padding:6px 10px;width:100%;box-sizing:border-box;outline:none;';

  panel.innerHTML =
    '<div class="bar">' +
      '<span style="color:#4fc3f7;font-weight:bold;letter-spacing:.08em;">Holding</span>' +
    '</div>' +
    '<div style="display:flex;height:calc(100% - 44px);">' +

      // ── 左ペイン（入力） ──
      '<div style="width:240px;min-width:200px;padding:16px 14px;box-sizing:border-box;' +
           'border-right:1px solid #1e2a38;overflow-y:auto;">' +

        '<div style="color:#607d8b;font-size:10px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;">FIR</div>' +
        '<select id="hold-fir" style="' + selStyle + '" onchange="updateHoldingTable()">' +
          firOpts +
        '</select>' +

        '<div style="color:#607d8b;font-size:10px;text-transform:uppercase;letter-spacing:.1em;margin:14px 0 6px 0;">Manual Altitude (ft)</div>' +
        '<input id="hold-alt" type="number" min="0" max="60000" placeholder="e.g. 18000 — overrides auto"' +
          ' style="' + inStyle + '" oninput="updateHoldingTable()">' +
        '<div style="color:#546e7a;font-size:11px;margin-top:5px;">現在高度を入力すると該当行をハイライト</div>' +

        '<div id="hold-auto-alt" style="margin-top:10px;"></div>' +

      '</div>' +

      // ── 右ペイン（テーブル） ──
      '<div style="flex:1;padding:16px 18px;overflow-y:auto;box-sizing:border-box;">' +
        '<div id="hold-table-area"></div>' +
      '</div>' +

    '</div>';

  // NAVLOGから巡航高度を自動提示
  var autoAltEl = document.getElementById('hold-auto-alt');
  if(autoAltEl) {
    var initFL = null;
    if(typeof FP_ROWS !== 'undefined' && FP_ROWS) {
      for(var i = 0; i < FP_ROWS.length; i++) {
        var r = FP_ROWS[i];
        if(r && r.id === 'TOC' && r.alt && String(r.alt).match(/^\d+$/)) {
          initFL = parseInt(String(r.alt), 10); break;
        }
      }
    }
    if(initFL) {
      autoAltEl.innerHTML =
        '<button class="btn" onclick="document.getElementById(\'hold-alt\').value=' + initFL +
        ';updateHoldingTable();" style="font-size:11px;padding:4px 8px;">' +
        'NAVLOGより: FL' + Math.round(initFL / 100) + ' を適用</button>';
    }
  }

  updateHoldingTable();
}

function updateHoldingTable() {
  var tableArea = document.getElementById('hold-table-area');
  if(!tableArea) return;

  var firSel = document.getElementById('hold-fir');
  var altEl  = document.getElementById('hold-alt');

  var firIdx = firSel ? parseInt(firSel.value, 10) : 3;
  var fir    = FIR_LIST[firIdx] || FIR_LIST[3];
  var altFt  = altEl && altEl.value.trim() !== '' ? parseInt(altEl.value, 10) : null;

  var data = HOLDING_DATA[fir.tableKey];
  if(!data) return;

  // 現在高度に対応する行インデックス
  var currentLevelIdx = -1;
  if(altFt !== null && !isNaN(altFt)) {
    for(var li = 0; li < data.levels.length; li++) {
      var prevMax = li === 0 ? 0 : data.levels[li - 1].maxFt;
      if(altFt > prevMax && altFt <= data.levels[li].maxFt) {
        currentLevelIdx = li; break;
      }
    }
  }

  var thStyle = 'padding:10px 12px;text-align:left;font-weight:600;font-size:12px;color:#90a4ae;' +
                'background:#0d1421;border-bottom:2px solid #1e2a38;white-space:nowrap;';
  var tdBase  = 'padding:10px 12px;font-size:13px;border-bottom:1px solid #0d1421;';
  var tdNorm  = tdBase + 'color:#cfd8dc;';
  var tdHL    = tdBase + 'color:#eceff1;';

  var html = '<div style="color:#546e7a;font-size:11px;margin-bottom:10px;">' + data.tableTitle + '</div>';
  html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;background:#111827;border-radius:8px;overflow:hidden;">';

  // ──── ICAO IV-1-1 ────
  if(data.type === 'icao') {
    html += '<thead><tr>' +
      '<th style="' + thStyle + 'width:35%;">Levels<sup>1</sup></th>' +
      '<th style="' + thStyle + '">Normal conditions</th>' +
      '<th style="' + thStyle + '">Turbulence conditions</th>' +
      '</tr></thead><tbody>';

    for(var i = 0; i < data.levels.length; i++) {
      var lv   = data.levels[i];
      var isHL = (i === currentLevelIdx);
      var rowBg = isHL ? 'background:rgba(79,195,247,0.08);' : '';
      var td   = isHL ? tdHL : tdNorm;
      var curTag = isHL ?
        '<div style="color:#4fc3f7;font-size:10px;font-weight:bold;margin-top:3px;">CURRENT ALTITUDE</div>' : '';

      html += '<tr style="' + rowBg + '">' +
        '<td style="' + td + '">' + lv.labelEN + curTag + '</td>' +
        '<td style="' + td + '">' + lv.normalHTML + '</td>' +
        '<td style="' + td + '">' + lv.turbHTML + '</td>' +
        '</tr>';
    }
    html += '</tbody></table></div>';

    // Footnotes（IV-1-1）
    if(data.footnotes.length) {
      html += '<div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;">';
      for(var fn = 0; fn < data.footnotes.length; fn++) {
        html += '<div style="color:#546e7a;font-size:11px;padding:2px 0;">' + data.footnotes[fn] + '</div>';
      }
      html += '</div>';
    }
  }

  // ──── TAIWAN ────
  else if(data.type === 'taiwan') {
    html += '<thead><tr>' +
      '<th style="' + thStyle + 'width:55%;">Levels</th>' +
      '<th style="' + thStyle + '">Air Speed (IAS)</th>' +
      '</tr></thead><tbody>';

    for(var j = 0; j < data.levels.length; j++) {
      var lj   = data.levels[j];
      var isHLj = (j === currentLevelIdx);
      var rowBgj = isHLj ? 'background:rgba(79,195,247,0.08);' : '';
      var tdj  = isHLj ? tdHL : tdNorm;
      var curTagj = isHLj ?
        '<div style="color:#4fc3f7;font-size:10px;font-weight:bold;margin-top:3px;">CURRENT ALTITUDE</div>' : '';

      html += '<tr style="' + rowBgj + '">' +
        '<td style="' + tdj + '">' + lj.labelEN + curTagj + '</td>' +
        '<td style="' + tdj + 'font-size:18px;font-weight:bold;color:#eceff1;">' + lj.speedHTML + '</td>' +
        '</tr>';
    }
    html += '</tbody></table></div>';
  }

  // ──── FAA ────
  else if(data.type === 'faa') {
    html += '<thead><tr>' +
      '<th style="' + thStyle + 'width:50%;">Altitude (MSL)</th>' +
      '<th style="' + thStyle + '">Airspeed (KIAS)</th>' +
      '</tr></thead><tbody>';

    for(var k = 0; k < data.levels.length; k++) {
      var lk   = data.levels[k];
      var isHLk = (k === currentLevelIdx);
      var rowBgk = isHLk ? 'background:rgba(79,195,247,0.08);' : '';
      var tdk  = isHLk ? tdHL : tdNorm;
      var curTagk = isHLk ?
        '<div style="color:#4fc3f7;font-size:10px;font-weight:bold;margin-top:3px;">CURRENT ALTITUDE</div>' : '';

      html += '<tr style="' + rowBgk + '">' +
        '<td style="' + tdk + '">' + lk.labelEN + curTagk + '</td>' +
        '<td style="' + tdk + 'font-size:18px;font-weight:bold;color:#eceff1;">' + lk.faaKt + ' KIAS</td>' +
        '</tr>';
    }
    html += '</tbody></table></div>';
  }

  // ──── FIR 固有 Warning ────
  var allWarnings = fir.warnings || [];
  for(var wi = 0; wi < allWarnings.length; wi++) {
    html += '<div style="margin-top:12px;padding:10px 14px;background:rgba(255,152,0,.1);' +
            'border:1px solid rgba(255,152,0,.3);border-radius:6px;color:#ff9800;font-size:12px;">' +
            allWarnings[wi] + '</div>';
  }

  // ──── Requirements & Notes ────
  var allNotes = fir.notes || [];
  if(allNotes.length) {
    html += '<div style="margin-top:14px;">' +
            '<div style="color:#607d8b;font-size:10px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">Requirements &amp; Notes</div>';
    for(var ni = 0; ni < allNotes.length; ni++) {
      html += '<div style="color:#546e7a;font-size:12px;padding:3px 0 3px 10px;' +
              'border-left:2px solid #1e2a38;margin-bottom:6px;">・ ' + allNotes[ni] + '</div>';
    }
    html += '</div>';
  }

  tableArea.innerHTML = html;
}
```

---

## Step 3: NAVLOG適用後に renderHoldingPanel() を呼ぶ

既存の `renderCurfewPanel()` 呼び出しの直後に追加:

```javascript
  if(typeof renderHoldingPanel === 'function') renderHoldingPanel();
```

---

## Step 4: メニューボタン追加

Planning セクションの `📝 MEMO` ボタンの直後:

```html
      <button class="nav-item" id="nav-holding" onclick="navTo('holding')">✈ Holding</button>
```

---

## Step 5: holding-panel の HTML を追加

`<!-- ===== CURFEW CALCULATOR ===== -->` の直前に挿入:

```html
<!-- ===== HOLDING ===== -->
<div id="holding-panel" class="panel">
  <!-- renderHoldingPanel() によって動的生成 -->
</div>
```

---

## Step 6: navTo('holding') で renderHoldingPanel() を呼ぶ

`if(id === 'curfew') renderCurfewPanel();` の直後に追加:

```javascript
  if(id === 'holding') renderHoldingPanel();
```

---

## 動作まとめ

| 操作 | 動作 |
|---|---|
| FIR変更 | ICAO IV-1-1 / Taiwan / FAA テーブルに切り替え |
| Manual Altitude 入力 | 該当行を水色ハイライト、CURRENT ALTITUDE タグ表示 |
| NAVLOGより適用ボタン | TOC の高度を自動セット |
| Taiwan 選択 | FL ベースの独自 2 列テーブルに切り替え |
| US (FAA) 選択 | FAA AIM 最大速度テーブル（2 列）に切り替え |
| FIR 固有 Warning | オレンジボックスで表示（Australia 250 kt など） |
| FIR 固有 Notes | 下部 Requirements & Notes セクションに表示 |

---

## 確認事項

- Japan FIR → IV-1-1 テーブル（≤14,000ft: 230 kt / 280 kt、14-20k: 240 kt / 280 kt or 0.8M）
- Taiwan 選択 → 独自テーブル（FL140: 230 kt、FL200: 240 kt、FL340: 265 kt、FL340+: M0.83）
- United States 選択 → FAA テーブル（200/230/265 KIAS）
- Australia 選択 → オレンジ Warning に「250 kt 制限」が表示される
- 高度 40000 を入力 → 最下行（34,000 ft 超 / 0.83 Mach）がハイライト
- NAVLOG 適用後、TOC 高度が「NAVLOGより適用」ボタンに表示される

---

## 実装順序

Step 1〜2 → commit → Step 3〜6 → commit
