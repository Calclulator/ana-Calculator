# 指示書：Cabin Crew BRFG パネル新設

対象ファイル: `index.html`
ES5厳守（var, function宣言, 文字列連結のみ）

---

## 概要

左メニューの Planning セクションに「👩‍✈️ CC BRFG」ボタンを追加。
参考: https://nq-calculator.vercel.app/ の Cabin Crew Briefing 画面。

**左ペイン（40%）:** フライト基本情報
**右ペイン（60%）:** ENROUTE WEATHER / TURBULENCE（テキスト＋チャート）

---

## 完成イメージ

```
┌────────────────────────────────────────────────────────────────┐
│  RJAA                TOKYO → KUALA LUMPUR            WMKK      │
│  STD 0835Z                                        STA 1605Z    │
├────────────────────────────────────────────────────────────────┤
│ [左ペイン 40%]              │ [右ペイン 60%]                    │
│                             │ ENROUTE WEATHER / TURBULENCE      │
│  SPOT / GATE    ___         │                                   │
│  TAXI OUT       46 min      │ Smooth 90%, Light Minus 7%,       │
│  FLIGHT TIME    7h 07min    │ Light 3% of path.                 │
│  BLOCK TIME     7h 30min    │ 2時間20分から2時間50分まで L の揺れ│
│                             │                                   │
│  ALTITUDE                   │ [Turbulence Chart - Canvas]       │
│  FL350, step to FL370 at    │  FL450 ─────────────────────────  │
│  41N50, FL390 at 41N40      │  FL400  ██████ (green=L)          │
│                             │  FL350 ──────── (flight path)     │
│  ALTERNATE                  │  FL300  ████   (blue=LM)          │
│  WSSS  53 min               │  ...                              │
│                             │  RJAA   1h   2h   3h    WMKK     │
│  SEAT BELTS OFF             │  Legend: □LM □L □L+ □M           │
│  [手動入力欄]               │                                   │
│                             │                                   │
│  DG & RADIOACTIVE           │                                   │
│  [手動入力欄]               │                                   │
│                             │                                   │
│  EMERGENCY / HIJACK         │                                   │
│  Standard ANA Policy        │                                   │
│                             │                                   │
│  COCKPIT ENTRY              │                                   │
│  Regular, Hijack and        │                                   │
│  Interphone                 │                                   │
│                             │                                   │
│  Have a nice flight! ✈      │                                   │
└─────────────────────────────┴───────────────────────────────────┘
```

---

## Step 1: グローバル変数の追加

`NAV_CREW_TOTAL = null;` の直後に追加:

```javascript
var NAV_TAXI_MIN = null;       // 離陸前TAXI時間（分）= B/T - F/T
var NAV_ALT_TIME_MIN = null;   // ALT空港までの飛行時間（分）
var NAV_INIT_FL = null;        // 初期巡航高度（フィート）例: 35000
var NAV_STEP_CLIMBS = [];      // Step Climb配列 [{fl:37000, wp:'41N50'}, ...]
var NAV_WINDS_ALOFT = {};      // WIND/TEMP ALOFT データ {wpName: {12000:spd, 18000:spd, ...}}
```

---

## Step 2: NAVLOGパース追加

`NAV_CREW_TOTAL` のパース直後に追加:

```javascript
  // TAXI OUT = B/T - F/T (ブロックタイム - 飛行時間 = 総タクシー時間)
  NAV_TAXI_MIN = null;
  if(NAV_BT_STR && NAV_FT_STR) {
    var btParts = NAV_BT_STR.split(':');
    var ftParts = NAV_FT_STR.split(':');
    var btTotalMin = parseInt(btParts[0], 10) * 60 + parseInt(btParts[1], 10);
    var ftTotalMin = parseInt(ftParts[0], 10) * 60 + parseInt(ftParts[1], 10);
    NAV_TAXI_MIN = btTotalMin - ftTotalMin;
  }

  // ALT空港への飛行時間: "ALT KONT 00/28 009700" → 28分
  NAV_ALT_TIME_MIN = null;
  var altTimeM = txt.match(/^ALT\s+[A-Z]{4}\s+(\d{2})\/(\d{2})/m);
  if(altTimeM) {
    NAV_ALT_TIME_MIN = parseInt(altTimeM[1], 10) * 60 + parseInt(altTimeM[2], 10);
  }

  // Step Climb: "STEP CLIMB 350/41N50 370/41N40 390/"
  NAV_STEP_CLIMBS = [];
  var scM = txt.match(/STEP\s+CLIMB\s+([\d\/\w\s]+)/);
  if(scM) {
    var scParts = scM[1].trim().split(/\s+/);
    for(var sci = 0; sci < scParts.length; sci++) {
      var scPair = scParts[sci].match(/^(\d{3})\/(\S+)?$/);
      if(scPair && scPair[1]) {
        NAV_STEP_CLIMBS.push({
          fl: parseInt(scPair[1], 10) * 100,
          wp: scPair[2] || ''
        });
      }
    }
  }

  // WINDS/TEMP ALOFT FCST パース
  // 形式: "WPTNAME  2655M06 2877M14 2895M27 7843M36 7863M43 7870M53 7850M62"
  // 各カラムは固定高度: 12000 18000 24000 30000 34000 39000 45000
  NAV_WINDS_ALOFT = {};
  var aloftAltsFt = [12000, 18000, 24000, 30000, 34000, 39000, 45000];
  var aloftSection = txt.match(/-WINDS\/TEMP ALOFT FCST[\s\S]*$/i);
  if(aloftSection) {
    var aloftLines = aloftSection[0].split('\n');
    for(var ai = 0; ai < aloftLines.length; ai++) {
      var aloftLine = aloftLines[ai].trim();
      // WP名＋7つの風値が並ぶ行
      var aloftRowM = aloftLine.match(/^([A-Z0-9]{2,8})\s+((?:[0-9]{4}[MP][0-9]{2}\s*){3,7})/);
      if(!aloftRowM) continue;
      var aloftWp = aloftRowM[1];
      var aloftVals = aloftRowM[2].trim().split(/\s+/);
      var wpData = {};
      for(var avi = 0; avi < aloftVals.length && avi < aloftAltsFt.length; avi++) {
        var aloftVal = aloftVals[avi];
        // 風向: 最初の2桁 (x10), 風速: 次の2桁 (特殊: dir>=50→dir-50, spd+100)
        var dirRaw = parseInt(aloftVal.slice(0, 2), 10);
        var spdRaw = parseInt(aloftVal.slice(2, 4), 10);
        var windSpd;
        if(dirRaw >= 50) { windSpd = spdRaw + 100; }
        else { windSpd = spdRaw; }
        if(aloftVal.slice(0,4) === '9900') { windSpd = 0; }
        wpData[aloftAltsFt[avi]] = windSpd;
      }
      NAV_WINDS_ALOFT[aloftWp] = wpData;
    }
  }

  // 初期巡航高度: FP_ROWSのTOCエントリから取得 (パース後に設定)
  // → renderCcBrfgPanel() 内で FP_ROWS を参照して取得
```

---

## Step 3: clearFpl() にクリア処理を追加

`NAV_CREW_TOTAL = null;` の直後:

```javascript
  NAV_TAXI_MIN = null; NAV_ALT_TIME_MIN = null;
  NAV_INIT_FL = null; NAV_STEP_CLIMBS = []; NAV_WINDS_ALOFT = {};
  if(typeof renderCcBrfgPanel === 'function') renderCcBrfgPanel();
```

---

## Step 4: showTab() に ccbrfg を追加

```javascript
  ['wx','fp','atm','atm-gfs','crew-rest','fdp','memo','ccbrfg'].forEach(function(n) {
```

---

## Step 5: 乱気流計算・描画関数の追加

`renderMemoPanel` 関数の直前に挿入:

```javascript
// ── 乱気流カテゴリ定義 ──────────────────────────────────────
var TURB_SMOOTH = 0, TURB_LM = 1, TURB_L = 2, TURB_LP = 3, TURB_MOD = 4;
var TURB_COLORS = ['', 'rgba(100,180,255,0.65)', 'rgba(80,200,80,0.7)',
                   'rgba(255,210,0,0.75)', 'rgba(255,100,0,0.85)'];
var TURB_LABELS = ['Smooth', 'Light Minus', 'Light', 'Light Plus', 'Moderate'];

// 風速差から乱気流カテゴリを返す（kts/1000ft）
function shearToTurb(shearPer1000ft) {
  if(shearPer1000ft < 4)  return TURB_SMOOTH;
  if(shearPer1000ft < 8)  return TURB_LM;
  if(shearPer1000ft < 14) return TURB_L;
  if(shearPer1000ft < 20) return TURB_LP;
  return TURB_MOD;
}

// 指定WP・高度における乱気流レベルを返す（WINDS/TEMP ALOFTから）
// altFt: チェックする高度（フィート）
function getTurbAtWp(wpName, altFt) {
  var aloftAltsFt = [12000, 18000, 24000, 30000, 34000, 39000, 45000];
  var wpData = NAV_WINDS_ALOFT[wpName];
  if(!wpData) return TURB_SMOOTH;
  // altFtを挟む2つの高度レベルを見つける
  var lower = -1, upper = -1;
  for(var i = 0; i < aloftAltsFt.length - 1; i++) {
    if(altFt >= aloftAltsFt[i] && altFt <= aloftAltsFt[i+1]) {
      lower = aloftAltsFt[i]; upper = aloftAltsFt[i+1]; break;
    }
  }
  if(lower === -1) {
    // 範囲外: 最も近いペアを使用
    if(altFt < aloftAltsFt[0]) { lower = aloftAltsFt[0]; upper = aloftAltsFt[1]; }
    else { lower = aloftAltsFt[aloftAltsFt.length-2]; upper = aloftAltsFt[aloftAltsFt.length-1]; }
  }
  var spdLower = wpData[lower], spdUpper = wpData[upper];
  if(spdLower === undefined || spdUpper === undefined) return TURB_SMOOTH;
  var altDiffK = (upper - lower) / 1000;
  var shear = Math.abs(spdUpper - spdLower) / altDiffK;
  return shearToTurb(shear);
}

// FP_ROWSから各WPの飛行時間(分)と高度を返すヘルパー
function buildFlightProfile() {
  // [{ctme, altFt, wpName}, ...]
  var profile = [];
  if(typeof FP_ROWS === 'undefined' || !FP_ROWS) return profile;
  for(var i = 0; i < FP_ROWS.length; i++) {
    var row = FP_ROWS[i];
    if(!row || row.ctme === null || row.ctme === undefined) continue;
    var altFt = null;
    if(row.alt && String(row.alt).match(/^\d+$/)) {
      altFt = parseInt(String(row.alt), 10);
    }
    profile.push({ ctme: row.ctme, altFt: altFt, name: row.id || '' });
  }
  return profile;
}

// 乱気流データ生成: チャート描画用
// 戻り値: {segments:[{ctme1,ctme2,altFt,turb}], totalMin, maxCtme, turbPct:{0:..,1:..,2:..}}
function buildTurbulenceData() {
  var profile = buildFlightProfile();
  var checkAlts = [12000, 18000, 24000, 30000, 34000, 39000, 45000];
  var result = { segments: [], totalMin: 0, turbPct: {} };
  var turbCount = [0, 0, 0, 0, 0]; // Smooth,LM,L,L+,M のセグメント数

  if(!profile.length) return result;
  result.totalMin = profile[profile.length-1].ctme;

  // WINDS/TEMP ALOFTデータがある場合
  var hasWindsAloft = Object.keys(NAV_WINDS_ALOFT).length > 0;

  for(var i = 0; i < profile.length - 1; i++) {
    var seg = profile[i];
    var nextSeg = profile[i+1];
    var ctme1 = seg.ctme, ctme2 = nextSeg.ctme;
    var segDur = ctme2 - ctme1;
    if(segDur <= 0) continue;

    // 各高度レベルのturb
    for(var ai = 0; ai < checkAlts.length; ai++) {
      var altFt = checkAlts[ai];
      var turb = TURB_SMOOTH;
      if(hasWindsAloft && seg.name) {
        turb = getTurbAtWp(seg.name, altFt);
      }
      result.segments.push({ ctme1: ctme1, ctme2: ctme2, altFt: altFt, turb: turb });
    }

    // 巡航高度の乱気流をパス%計算に使用
    var cruiseAltFt = seg.altFt || 35000;
    var pathTurb = TURB_SMOOTH;
    if(hasWindsAloft && seg.name) {
      pathTurb = getTurbAtWp(seg.name, cruiseAltFt);
    }
    turbCount[pathTurb] += segDur;
  }

  var totalCounted = turbCount.reduce(function(a, b) { return a + b; }, 0);
  for(var ti = 0; ti < turbCount.length; ti++) {
    result.turbPct[ti] = totalCounted > 0 ? Math.round(turbCount[ti] / totalCounted * 100) : 0;
  }
  return result;
}

// 乱気流サマリーテキストを生成
function buildTurbulenceText(turbData) {
  var parts = [];
  var labels = ['Smooth', 'Light Minus', 'Light', 'Light Plus', 'Moderate'];
  for(var i = 0; i < labels.length; i++) {
    var pct = turbData.turbPct[i] || 0;
    if(pct > 0) parts.push(labels[i] + ' ' + pct + '%');
  }
  var txt = parts.join(', ') + ' of path.';

  // L以上(turb>=2)の連続区間を10分単位で丸めて記載
  var profile = buildFlightProfile();
  var lSegs = []; // {start, end} in ctme minutes
  var inL = false, lStart = 0;
  for(var j = 0; j < profile.length - 1; j++) {
    var seg = profile[j];
    var cruiseAlt = seg.altFt || 35000;
    var hasWA = Object.keys(NAV_WINDS_ALOFT).length > 0;
    var turb = (hasWA && seg.name) ? getTurbAtWp(seg.name, cruiseAlt) : TURB_SMOOTH;
    if(turb >= TURB_L && !inL) { inL = true; lStart = seg.ctme; }
    if(turb < TURB_L && inL)  { inL = false; lSegs.push({s: lStart, e: seg.ctme}); }
  }
  if(inL && profile.length) lSegs.push({s: lStart, e: profile[profile.length-1].ctme});

  // 近接セグメントをマージ（10分以内）
  var merged = [];
  for(var k = 0; k < lSegs.length; k++) {
    if(merged.length && lSegs[k].s - merged[merged.length-1].e <= 10) {
      merged[merged.length-1].e = lSegs[k].e;
    } else {
      merged.push({s: lSegs[k].s, e: lSegs[k].e});
    }
  }

  // フォーマット: X時間Y0分 (start=floor10, end=ceil10)
  function fmt10(min) {
    var h = Math.floor(min / 60);
    var m = min % 60;
    return h + '時間' + m + '分';
  }
  for(var m = 0; m < merged.length; m++) {
    var startRounded = Math.floor(merged[m].s / 10) * 10;
    var endRounded   = Math.ceil(merged[m].e / 10) * 10;
    txt += '\n' + fmt10(startRounded) + 'から' + fmt10(endRounded) + 'まで L の揺れ';
  }
  return txt;
}

// 乱気流チャート描画 (Canvas)
function renderTurbulenceChart(canvas, turbData) {
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var padL = 42, padR = 12, padT = 10, padB = 32;
  var chartW = W - padL - padR, chartH = H - padT - padB;

  ctx.clearRect(0, 0, W, H);

  var totalMin = turbData.totalMin || 1;
  var altMin = 10000, altMax = 47000; // FLチャート範囲

  function xOf(ctme) { return padL + ctme / totalMin * chartW; }
  function yOf(altFt) { return padT + chartH - (altFt - altMin) / (altMax - altMin) * chartH; }

  // 背景
  ctx.fillStyle = '#080c14';
  ctx.fillRect(0, 0, W, H);

  // 乱気流セグメント描画
  var altBandHeight = checkAltBandH(turbData); // 各altの描画高さ
  var checkAlts = [12000, 18000, 24000, 30000, 34000, 39000, 45000];
  for(var si = 0; si < turbData.segments.length; si++) {
    var seg = turbData.segments[si];
    if(seg.turb === TURB_SMOOTH) continue;
    var color = TURB_COLORS[seg.turb];
    if(!color) continue;
    ctx.fillStyle = color;
    var x1 = xOf(seg.ctme1), x2 = xOf(seg.ctme2);
    // このaltFtの上下の高度を見つけてバンド高さを計算
    var altIdx = checkAlts.indexOf(seg.altFt);
    var bandBot = altIdx > 0 ? (seg.altFt + checkAlts[altIdx-1]) / 2 : seg.altFt - 3000;
    var bandTop = altIdx < checkAlts.length-1 ? (seg.altFt + checkAlts[altIdx+1]) / 2 : seg.altFt + 3000;
    var yTop = yOf(bandTop), yBot = yOf(bandBot);
    ctx.fillRect(x1, yTop, Math.max(x2-x1, 1), yBot-yTop);
  }

  // グリッド線（高度）
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  var flLabels = [100,150,200,250,300,350,400,450];
  ctx.font = '9px monospace';
  ctx.fillStyle = '#607d8b';
  ctx.textAlign = 'right';
  for(var fi = 0; fi < flLabels.length; fi++) {
    var yy = yOf(flLabels[fi] * 100);
    ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(padL+chartW, yy); ctx.stroke();
    ctx.fillText('FL' + flLabels[fi], padL - 3, yy + 3);
  }

  // 飛行プロファイル（黒線）
  var profile = buildFlightProfile();
  if(profile.length > 1) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    var started = false;
    for(var pi = 0; pi < profile.length; pi++) {
      var pt = profile[pi];
      if(pt.altFt === null) continue;
      var px = xOf(pt.ctme), py = yOf(pt.altFt);
      if(!started) { ctx.moveTo(px, py); started = true; }
      else { ctx.lineTo(px, py); }
    }
    ctx.stroke();
  }

  // X軸ラベル（1時間ごと）
  ctx.fillStyle = '#607d8b';
  ctx.textAlign = 'center';
  ctx.font = '9px monospace';
  var hourCount = Math.floor(totalMin / 60);
  for(var hi = 0; hi <= hourCount; hi++) {
    var hx = xOf(hi * 60);
    ctx.fillText(hi + 'h', hx, H - padB + 14);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath(); ctx.moveTo(hx, padT); ctx.lineTo(hx, padT+chartH); ctx.stroke();
  }
  // 出発・到着ラベル
  ctx.fillStyle = '#4fc3f7';
  ctx.textAlign = 'left';
  ctx.fillText(NAV_DEP || '', padL, H - padB + 25);
  ctx.textAlign = 'right';
  ctx.fillText(NAV_DEST || '', padL + chartW, H - padB + 25);

  // レジェンド
  var legX = padL + 4, legY = padT + 4;
  var legItems = [[TURB_LM,'LM'], [TURB_L,'L'], [TURB_LP,'L+'], [TURB_MOD,'M']];
  for(var li = 0; li < legItems.length; li++) {
    ctx.fillStyle = TURB_COLORS[legItems[li][0]];
    ctx.fillRect(legX, legY, 12, 9);
    ctx.fillStyle = '#90a4ae';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(legItems[li][1], legX + 14, legY + 8);
    legX += 32;
  }
}

function checkAltBandH(turbData) { return 0; } // プレースホルダー（未使用）

function renderCcBrfgPanel() {
  var panel = document.getElementById('ccbrfg-panel');
  if(!panel) return;

  // フォーマットヘルパー
  function fmtMin(min) {
    if(min === null || min === undefined) return '—';
    if(min < 60) return min + ' min';
    return Math.floor(min/60) + 'h ' + (min%60) + 'min';
  }
  function fmtFL(ft) {
    if(!ft) return '—';
    return 'FL' + Math.round(ft / 100);
  }

  // 初期巡航高度 (TOC WPの高度)
  var initFL = null;
  if(typeof FP_ROWS !== 'undefined' && FP_ROWS) {
    for(var i = 0; i < FP_ROWS.length; i++) {
      var r = FP_ROWS[i];
      if(r && r.id === 'TOC' && r.alt && String(r.alt).match(/^\d+$/)) {
        initFL = parseInt(String(r.alt), 10); break;
      }
    }
    // TOCがなければ最初に数値高度が出るWP
    if(!initFL) {
      for(var j = 0; j < FP_ROWS.length; j++) {
        var rj = FP_ROWS[j];
        if(rj && rj.alt && String(rj.alt).match(/^\d{4,5}$/)) {
          initFL = parseInt(String(rj.alt), 10); break;
        }
      }
    }
  }

  // ALT飛行時間テキスト
  var altTimeStr = NAV_ALT_TIME_MIN !== null ? fmtMin(NAV_ALT_TIME_MIN) : '—';

  // 高度テキスト生成
  var altText = initFL ? fmtFL(initFL) : '—';
  if(NAV_STEP_CLIMBS && NAV_STEP_CLIMBS.length) {
    for(var si = 0; si < NAV_STEP_CLIMBS.length; si++) {
      var sc = NAV_STEP_CLIMBS[si];
      if(sc.fl && sc.fl > 0) {
        altText += ', step to ' + fmtFL(sc.fl) + (sc.wp ? ' at ' + sc.wp : '');
      }
    }
  }

  // 乱気流データ
  var turbData = buildTurbulenceData();
  var turbText = buildTurbulenceText(turbData);

  // NAVLOG未適用時
  var notReady = !NAV_DEP && !NAV_DEST;

  panel.innerHTML =
    '<div class="bar">' +
      '<span style="color:#4fc3f7;font-weight:bold;letter-spacing:.08em;">CC BRFG</span>' +
      '<span style="margin-left:12px;color:#607d8b;font-size:11px;">Reference information only, for use while cabin doors are open</span>' +
    '</div>' +
    '<div style="display:flex;height:calc(100% - 44px);overflow:hidden;">' +

      // ── 左ペイン ──
      '<div style="width:40%;min-width:220px;padding:14px 16px;box-sizing:border-box;' +
           'border-right:1px solid #1e2a38;overflow-y:auto;">' +

        // ルートヘッダー
        '<div style="display:flex;justify-content:space-between;margin-bottom:4px;">' +
          '<div>' +
            '<div style="font-size:20px;font-weight:bold;color:#eceff1;">' + (NAV_DEP||'—') + '</div>' +
            '<div style="font-size:11px;color:#607d8b;">STD ' + (NAV_STD ? NAV_STD.slice(0,2)+NAV_STD.slice(2)+'Z' : '—') + '</div>' +
          '</div>' +
          '<div style="font-size:18px;color:#4fc3f7;align-self:center;">→</div>' +
          '<div style="text-align:right;">' +
            '<div style="font-size:20px;font-weight:bold;color:#eceff1;">' + (NAV_DEST||'—') + '</div>' +
            '<div style="font-size:11px;color:#607d8b;">STA ' + (NAV_STA ? NAV_STA.slice(0,2)+NAV_STA.slice(2)+'Z' : '—') + '</div>' +
          '</div>' +
        '</div>' +

        '<div style="height:1px;background:#1e2a38;margin:10px 0;"></div>' +

        // フライト情報グリッド
        '<table style="width:100%;border-collapse:collapse;font-size:12px;color:#cfd8dc;">' +
          '<tr><td style="color:#607d8b;padding:4px 0;">SPOT / GATE</td>' +
              '<td><input id="ccbrfg-spot" style="background:transparent;border:none;border-bottom:1px solid #1e2a38;color:#cfd8dc;width:100%;font-size:12px;" placeholder="—"></td></tr>' +
          '<tr><td style="color:#607d8b;padding:4px 0;">TAXI OUT</td>' +
              '<td style="color:#eceff1;">' + (NAV_TAXI_MIN !== null ? NAV_TAXI_MIN + ' min' : '—') + '</td></tr>' +
          '<tr><td style="color:#607d8b;padding:4px 0;">FLIGHT TIME</td>' +
              '<td style="color:#eceff1;">' + (NAV_FT_STR ? NAV_FT_STR.replace(':','h ')+'min' : '—') + '</td></tr>' +
          '<tr><td style="color:#607d8b;padding:4px 0;">BLOCK TIME</td>' +
              '<td style="color:#eceff1;">' + (NAV_BT_STR ? NAV_BT_STR.replace(':','h ')+'min' : '—') + '</td></tr>' +
        '</table>' +

        '<div style="height:1px;background:#1e2a38;margin:10px 0;"></div>' +

        '<div style="color:#607d8b;font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">ALTITUDE</div>' +
        '<div style="color:#eceff1;font-size:12px;">' + altText + '</div>' +

        '<div style="height:1px;background:#1e2a38;margin:10px 0;"></div>' +

        '<div style="color:#607d8b;font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">ALTERNATE</div>' +
        '<div style="color:#eceff1;font-size:12px;">' +
          (NAV_ALT_APT || '—') + '&nbsp;&nbsp;<span style="color:#607d8b;">' + altTimeStr + '</span>' +
        '</div>' +

        '<div style="height:1px;background:#1e2a38;margin:10px 0;"></div>' +

        '<div style="color:#607d8b;font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">SEAT BELTS OFF</div>' +
        '<input id="ccbrfg-sbo" style="width:100%;background:transparent;border:none;border-bottom:1px solid #1e2a38;' +
               'color:#cfd8dc;font-size:12px;padding:2px 0;" placeholder="e.g. 10–15 min after T/O">' +

        '<div style="height:1px;background:#1e2a38;margin:10px 0;"></div>' +

        '<div style="color:#607d8b;font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">DG &amp; RADIOACTIVE</div>' +
        '<input id="ccbrfg-dg" style="width:100%;background:transparent;border:none;border-bottom:1px solid #1e2a38;' +
               'color:#cfd8dc;font-size:12px;padding:2px 0;" placeholder="Nil">' +

        '<div style="height:1px;background:#1e2a38;margin:10px 0;"></div>' +

        '<div style="color:#607d8b;font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">EMERGENCY / HIJACK</div>' +
        '<div style="color:#eceff1;font-size:12px;">Standard ANA Policy</div>' +

        '<div style="height:1px;background:#1e2a38;margin:10px 0;"></div>' +

        '<div style="color:#607d8b;font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">COCKPIT ENTRY</div>' +
        '<div style="color:#eceff1;font-size:12px;">Regular, Hijack and Interphone</div>' +

        '<div style="height:1px;background:#1e2a38;margin:20px 0 10px 0;"></div>' +
        '<div style="color:#4fc3f7;font-size:13px;">Have a nice flight! ✈</div>' +

      '</div>' + // 左ペイン終わり

      // ── 右ペイン ──
      '<div style="flex:1;padding:14px 16px;box-sizing:border-box;display:flex;flex-direction:column;">' +
        '<div style="color:#607d8b;font-size:10px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">' +
          'ENROUTE WEATHER / TURBULENCE' +
        '</div>' +
        '<div id="ccbrfg-turb-text" style="color:#cfd8dc;font-size:13px;line-height:1.8;margin-bottom:12px;white-space:pre-line;">' +
          (notReady ? '（NAVLOGを適用すると自動表示されます）' : turbText) +
        '</div>' +
        '<canvas id="ccbrfg-canvas" style="width:100%;flex:1;border-radius:4px;" height="320"></canvas>' +
      '</div>' +

    '</div>'; // flex終わり

  // Canvas描画
  if(!notReady) {
    var canvas = document.getElementById('ccbrfg-canvas');
    if(canvas) {
      canvas.width = canvas.offsetWidth || 600;
      renderTurbulenceChart(canvas, turbData);
    }
  }
}
```

---

## Step 6: NAVLOG適用後に呼ぶ

`renderMemoPanel()` の呼び出し直後に追加:

```javascript
  if(typeof renderCcBrfgPanel === 'function') renderCcBrfgPanel();
```

---

## Step 7: メニューボタン追加

`📝 MEMO` ボタンの直後:

```html
      <button class="nav-item" id="nav-ccbrfg" onclick="navTo('ccbrfg')">👩‍✈️ CC BRFG</button>
```

---

## Step 8: ccbrfg-panel の HTML 追加

`<!-- ===== MEMO ===== -->` の直前に挿入:

```html
<!-- ===== CC BRFG ===== -->
<div id="ccbrfg-panel" class="panel">
  <!-- renderCcBrfgPanel() によって動的に生成 -->
</div>
```

---

## Step 9: navTo('ccbrfg') 対応

`navTo` 関数内で `ccbrfg` を選択したとき `renderCcBrfgPanel()` を呼ぶ:

`navTo` 関数のパネル切替処理末尾（`if(id === 'memo') renderMemoPanel();` の直後）に追加:

```javascript
  if(id === 'ccbrfg') renderCcBrfgPanel();
```

---

## 乱気流カテゴリ基準（WINDS/TEMP ALOFT の垂直シアーから推定）

| カテゴリ | シアー (kt/1000ft) | チャート色 |
|---|---|---|
| Smooth | < 4 | 透明 |
| Light Minus (LM) | 4〜8 | 水色 |
| Light (L) | 8〜14 | 緑 |
| Light Plus (L+) | 14〜20 | 黄 |
| Moderate (M) | ≥ 20 | オレンジ |

---

## L以上の揺れ時刻表示ルール

- 開始時刻: **10分単位で切り捨て** (2+24 → 2+20)
- 終了時刻: **10分単位で切り上げ** (2+45 → 2+50)
- 表示形式: `X時間Y0分からX時間Y0分まで L の揺れ`
- 隣接区間（10分以内）はマージして1つの区間として表示

---

## 注意事項

- WINDS/TEMP ALOFT FCST が NAVLOG に含まれていない場合、全区間 Smooth と表示
- GFSデータとの統合は将来拡張として、今回は WINDS/TEMP ALOFT を優先使用
- Canvas描画は `navTo('ccbrfg')` 時に `canvas.offsetWidth` から幅を取得するため、タブ切替後に呼ぶこと
- 手動入力欄（SPOT/GATE、SEAT BELTS OFF、DG）の値は `renderCcBrfgPanel()` 再呼び出しでリセットされるため、値を保存する場合は呼び出し前後で退避・復元する

---

## 実装順序

Step 1〜3（パース） → commit → Step 4〜9（UI） → commit
