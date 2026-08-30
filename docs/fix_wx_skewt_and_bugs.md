# 修正指示書: WX バグ修正 + SKEW-T 完全刷新

以下7件を修正する。**ES5 厳守 (var / function のみ)。**
**既存の FLT PLN・NAVLOG・NOTAM ロジックは変更しないこと。**

---

## 修正 1: SKEW-T 描画を tono2.net/skewt2 準拠のライトテーマに刷新

### 1-1. `wxOfpDrawSkewt(levels, title, cb)` を以下で完全置き換え

OFP SKEW-T・WX SKEW-T 両方が共有しているため、これ1か所の変更で両方に効く。

```javascript
function wxOfpDrawSkewt(levels, title, cb) {
  var W = 870, H = 820;
  var PAD_L = 70, PAD_R = 220, PAD_T = 50, PAD_B = 55;
  var plotW = W - PAD_L - PAD_R;   // 580
  var plotH = H - PAD_T - PAD_B;   // 715

  // スキュー係数 SKEW=1.0: 上層 100hPa の −70°C が全てプロット内に収まる
  var T_MIN = -50, T_RANGE = 100;
  var SKEW = 1.0;
  var P_BOT = 1050, P_TOP = 100;
  var logPBot = Math.log(P_BOT), logPTop = Math.log(P_TOP);

  function yP(p) {
    var f = (logPBot - Math.log(p)) / (logPBot - logPTop);
    return PAD_T + (1 - f) * plotH;
  }

  function xT(t, p) {
    var f = (logPBot - Math.log(p)) / (logPBot - logPTop);
    return PAD_L + ((t - T_MIN) / T_RANGE + SKEW * f) * plotW;
  }

  var canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  var ctx = canvas.getContext('2d');

  // 白背景
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f9f9f7'; ctx.fillRect(PAD_L, PAD_T, plotW, plotH);

  // === プロット内クリップ ===
  ctx.save();
  ctx.beginPath(); ctx.rect(PAD_L, PAD_T, plotW, plotH); ctx.clip();

  // 混合比線 (緑破線、〜600 hPa)
  var mrVals = [1, 2, 4, 7, 10, 16, 20];
  ctx.lineWidth = 0.7; ctx.strokeStyle = '#66aa55'; ctx.setLineDash([3, 6]);
  for (var mi = 0; mi < mrVals.length; mi++) {
    var w = mrVals[mi];
    ctx.beginPath(); var mFst = true;
    for (var mp = 1000; mp >= 600; mp -= 5) {
      var esM = w * mp / (622 + w);
      if (esM <= 0) { continue; }
      var lM = Math.log(esM / 6.112);
      var TdM = 243.5 * lM / (17.67 - lM);
      if (mFst) { ctx.moveTo(xT(TdM, mp), yP(mp)); mFst = false; }
      else { ctx.lineTo(xT(TdM, mp), yP(mp)); }
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // 乾燥断熱線 (茶色破線)
  var thetaArr = [-30, -20, -10, 0, 10, 20, 30, 40, 50, 60, 70, 80];
  ctx.lineWidth = 0.7; ctx.strokeStyle = '#cc8800'; ctx.setLineDash([5, 5]);
  for (var ai = 0; ai < thetaArr.length; ai++) {
    var thK = thetaArr[ai] + 273.15;
    ctx.beginPath(); var aFst = true;
    for (var ap = P_BOT; ap >= P_TOP; ap -= 5) {
      var Tda = thK * Math.pow(ap / 1000, 0.2854) - 273.15;
      if (aFst) { ctx.moveTo(xT(Tda, ap), yP(ap)); aFst = false; }
      else { ctx.lineTo(xT(Tda, ap), yP(ap)); }
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // 湿潤断熱線 = 擬似断熱線 (青紫破線、Bolton 積分)
  var tw0Arr = [0, 5, 10, 15, 20, 24, 28, 32];
  ctx.lineWidth = 0.7; ctx.strokeStyle = '#8888cc'; ctx.setLineDash([2, 5]);
  for (var wi = 0; wi < tw0Arr.length; wi++) {
    var maTk = tw0Arr[wi] + 273.15;
    ctx.beginPath(); ctx.moveTo(xT(tw0Arr[wi], 1000), yP(1000));
    for (var wap = 995; wap >= P_TOP; wap -= 5) {
      var maEs = 6.112 * Math.exp(17.67 * (maTk - 273.15) / (maTk - 29.65));
      var maWs = 0.622 * maEs / Math.max(wap + 5 - maEs, 0.01);
      var maNum = 1 + 2.5e6 * maWs / (287 * maTk);
      var maDen = 1 + 2.5e6 * 2.5e6 * maWs / (1004 * 461.5 * maTk * maTk);
      var maDtp = -(9.81 / 1004) * (maNum / maDen) * 287 * maTk / ((wap + 5) * 9.81 * 100);
      maTk += maDtp * (-5);
      if (maTk < 170) { break; }
      ctx.lineTo(xT(maTk - 273.15, wap), yP(wap));
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // 等温線 (薄灰、10°C 間隔)
  for (var Ti = -120; Ti <= 60; Ti += 10) {
    var is0 = (Ti === 0);
    ctx.lineWidth = is0 ? 1.5 : 0.6;
    ctx.strokeStyle = is0 ? '#009966' : '#cccccc';
    ctx.beginPath();
    ctx.moveTo(xT(Ti, P_BOT), yP(P_BOT));
    ctx.lineTo(xT(Ti, P_TOP), yP(P_TOP));
    ctx.stroke();
  }

  // 等圧線 (水平)
  var PLIST = [100, 150, 200, 250, 300, 400, 500, 600, 700, 850, 925, 1000];
  var PMAJ  = {100:1, 200:1, 300:1, 500:1, 700:1, 850:1, 925:1, 1000:1};
  for (var pi2 = 0; pi2 < PLIST.length; pi2++) {
    var pv = PLIST[pi2];
    ctx.strokeStyle = PMAJ[pv] ? '#999999' : '#dddddd';
    ctx.lineWidth   = PMAJ[pv] ? 0.8 : 0.4;
    ctx.beginPath(); ctx.moveTo(PAD_L, yP(pv)); ctx.lineTo(PAD_L + plotW, yP(pv)); ctx.stroke();
  }

  ctx.restore(); // クリップ解除

  // 気圧ラベル (左軸)
  ctx.textAlign = 'right'; ctx.font = '11px monospace'; ctx.fillStyle = '#333333';
  for (var pi3 = 0; pi3 < PLIST.length; pi3++) {
    var pv = PLIST[pi3], py = yP(pv);
    ctx.fillText(pv + '', PAD_L - 4, py + 4);
    ctx.beginPath(); ctx.moveTo(PAD_L - 3, py); ctx.lineTo(PAD_L, py);
    ctx.strokeStyle = '#555555'; ctx.lineWidth = 1; ctx.stroke();
  }

  // Y軸ラベル
  ctx.save(); ctx.translate(14, PAD_T + plotH / 2); ctx.rotate(-Math.PI / 2);
  ctx.font = '10px sans-serif'; ctx.fillStyle = '#333333'; ctx.textAlign = 'center';
  ctx.fillText('Pressure (hPa)', 0, 0);
  ctx.restore();

  // 温度軸ラベル (下)
  ctx.textAlign = 'center';
  for (var Tl = -40; Tl <= 40; Tl += 10) {
    var lx2 = xT(Tl, P_BOT);
    if (lx2 < PAD_L || lx2 > PAD_L + plotW) { continue; }
    var is0l = (Tl === 0);
    ctx.fillStyle = is0l ? '#009966' : '#555555';
    ctx.font = is0l ? 'bold 9px sans-serif' : '9px sans-serif';
    ctx.fillText(Tl + '°', lx2, PAD_T + plotH + 15);
  }
  ctx.font = '10px sans-serif'; ctx.fillStyle = '#333333';
  ctx.fillText('Temperature (°C)', PAD_L + plotW / 2, H - 4);

  // FL アノテーション (右側、赤)
  var FL_DATA = [
    {fl:'FL450',p:150},{fl:'FL390',p:200},{fl:'FL340',p:257},
    {fl:'FL300',p:301},{fl:'FL240',p:400},{fl:'FL180',p:507},
    {fl:'FL140',p:598},{fl:'FL100',p:697},{fl:'FL050',p:843}
  ];
  ctx.textAlign = 'left'; ctx.font = 'bold 9px monospace'; ctx.fillStyle = '#cc0000';
  for (var fi = 0; fi < FL_DATA.length; fi++) {
    var fd = FL_DATA[fi], yfl = yP(fd.p);
    ctx.beginPath(); ctx.moveTo(PAD_L + plotW, yfl); ctx.lineTo(PAD_L + plotW + 4, yfl);
    ctx.strokeStyle = '#cc0000'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillText(fd.fl, PAD_L + plotW + 6, yfl + 3);
  }

  // ソート
  var sorted = levels.slice().sort(function(a, b) { return b.pres - a.pres; });

  // DGZ: 環境温度 −10〜−20°C の層 (左端に赤破線)
  var dgzBot = null, dgzTop = null;
  for (var li = 0; li < sorted.length; li++) {
    var lv = sorted[li];
    if (lv.temp !== null && lv.temp !== undefined && lv.temp <= -10 && lv.temp >= -20) {
      if (dgzBot === null) { dgzBot = lv.pres; }
      dgzTop = lv.pres;
    }
  }
  if (dgzBot !== null && dgzTop !== null && dgzBot !== dgzTop) {
    ctx.setLineDash([5, 3]); ctx.lineWidth = 1.5; ctx.strokeStyle = '#ff3333';
    var dgzY1 = yP(dgzBot), dgzY2 = yP(dgzTop);
    ctx.beginPath(); ctx.moveTo(PAD_L - 10, dgzY1); ctx.lineTo(PAD_L + 2, dgzY1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD_L - 10, dgzY2); ctx.lineTo(PAD_L + 2, dgzY2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '8px sans-serif'; ctx.fillStyle = '#ff3333'; ctx.textAlign = 'right';
    ctx.fillText('DGZ', PAD_L - 2, (dgzY1 + dgzY2) / 2 + 3);
  }

  // === データトレース (クリップ内) ===
  if (sorted.length > 0) {
    ctx.save();
    ctx.beginPath(); ctx.rect(PAD_L, PAD_T, plotW, plotH); ctx.clip();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    // 湿球温度 (近似: 簡易 Stull 法)
    ctx.beginPath();
    var wbFst = true;
    for (var li = 0; li < sorted.length; li++) {
      var lv = sorted[li];
      if (lv.temp === null || lv.dwpt === null ||
          lv.temp === undefined || lv.dwpt === undefined) { continue; }
      var esT = Math.exp(17.67 * lv.temp / (lv.temp + 243.5));
      var esTd = Math.exp(17.67 * lv.dwpt / (lv.dwpt + 243.5));
      var rh = esTd / esT;
      var tw = lv.temp - (1 - rh) * (lv.temp - lv.dwpt) * 0.37;
      if (wbFst) { ctx.moveTo(xT(tw, lv.pres), yP(lv.pres)); wbFst = false; }
      else { ctx.lineTo(xT(tw, lv.pres), yP(lv.pres)); }
    }
    ctx.strokeStyle = '#aa44aa'; ctx.lineWidth = 1.2; ctx.stroke();

    // 露点 (緑)
    ctx.beginPath(); var dFst = true;
    for (var li = 0; li < sorted.length; li++) {
      var lv = sorted[li];
      if (lv.dwpt === null || lv.dwpt === undefined) { continue; }
      if (dFst) { ctx.moveTo(xT(lv.dwpt, lv.pres), yP(lv.pres)); dFst = false; }
      else { ctx.lineTo(xT(lv.dwpt, lv.pres), yP(lv.pres)); }
    }
    ctx.strokeStyle = '#00aa00'; ctx.lineWidth = 2.5; ctx.stroke();

    // 温度 (赤)
    ctx.beginPath(); var tFst = true;
    for (var li = 0; li < sorted.length; li++) {
      var lv = sorted[li];
      if (lv.temp === null || lv.temp === undefined) { continue; }
      if (tFst) { ctx.moveTo(xT(lv.temp, lv.pres), yP(lv.pres)); tFst = false; }
      else { ctx.lineTo(xT(lv.temp, lv.pres), yP(lv.pres)); }
    }
    ctx.strokeStyle = '#ff2200'; ctx.lineWidth = 2.5; ctx.stroke();

    // データ点マーカー
    for (var li = 0; li < sorted.length; li++) {
      var lv = sorted[li];
      if (lv.temp !== null && lv.temp !== undefined) {
        ctx.beginPath(); ctx.arc(xT(lv.temp, lv.pres), yP(lv.pres), 2, 0, 2 * Math.PI);
        ctx.fillStyle = '#ff4444'; ctx.fill();
      }
      if (lv.dwpt !== null && lv.dwpt !== undefined) {
        ctx.beginPath(); ctx.arc(xT(lv.dwpt, lv.pres), yP(lv.pres), 2, 0, 2 * Math.PI);
        ctx.fillStyle = '#00cc00'; ctx.fill();
      }
    }

    ctx.restore();
  }

  // === 風向バーブ (Open-Meteo = km/h → × 0.53996 → kt) ===
  var xBarb = PAD_L + plotW + 100;
  for (var li = 0; li < sorted.length; li++) {
    var lv = sorted[li];
    wxOfpDrawWindBarb(ctx, xBarb, yP(lv.pres), (lv.wspd || 0) * 0.53996, lv.wdir || 0);
  }

  // === 右パネル: ホドグラフ ===
  var hodoX = PAD_L + plotW + 135;
  var hodoR = 65;
  var hodoCX = hodoX + hodoR + 5, hodoCY = PAD_T + hodoR + 10;

  ctx.fillStyle = '#f4f4f4';
  ctx.fillRect(hodoX, PAD_T, hodoR * 2 + 10, hodoR * 2 + 10);
  ctx.strokeStyle = '#aaaaaa'; ctx.lineWidth = 0.5;
  ctx.strokeRect(hodoX, PAD_T, hodoR * 2 + 10, hodoR * 2 + 10);

  var ktScale = hodoR / 80; // 80 kt max
  ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 0.5;
  for (var hr = 20; hr <= 80; hr += 20) {
    ctx.beginPath(); ctx.arc(hodoCX, hodoCY, hr * ktScale, 0, 2 * Math.PI); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(hodoX + 2, hodoCY); ctx.lineTo(hodoX + hodoR * 2 + 8, hodoCY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hodoCX, PAD_T + 2); ctx.lineTo(hodoCX, PAD_T + hodoR * 2 + 8); ctx.stroke();

  // ホドグラフトレース (地上〜300 hPa)
  if (sorted.length > 0) {
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#0055cc';
    ctx.beginPath(); var hFst = true;
    for (var li = sorted.length - 1; li >= 0; li--) {
      var lv = sorted[li];
      if (!lv.wspd || lv.pres < 250) { continue; }
      var spd2 = lv.wspd * 0.53996;
      var dRad = lv.wdir * Math.PI / 180;
      var u = -spd2 * Math.sin(dRad);
      var v = -spd2 * Math.cos(dRad);
      var hx = hodoCX + u * ktScale, hy = hodoCY - v * ktScale;
      if (hFst) { ctx.moveTo(hx, hy); hFst = false; } else { ctx.lineTo(hx, hy); }
    }
    ctx.stroke();
  }
  ctx.font = '8px sans-serif'; ctx.fillStyle = '#333333'; ctx.textAlign = 'center';
  ctx.fillText('Hodograph (wind in kt)', hodoCX, PAD_T + hodoR * 2 + 22);

  // === 右パネル: 指数 ===
  var idxX = hodoX, idxY = PAD_T + hodoR * 2 + 32;

  var T850 = null, T500 = null, Td850 = null, T700 = null, Td700 = null;
  for (var li = 0; li < sorted.length; li++) {
    var lv = sorted[li];
    if (lv.pres === 850)  { T850 = lv.temp; Td850 = lv.dwpt; }
    if (lv.pres === 700)  { T700 = lv.temp; Td700 = lv.dwpt; }
    if (lv.pres === 500)  { T500 = lv.temp; }
  }

  ctx.font = '9px monospace'; ctx.textAlign = 'left';
  var idxRows = [];
  if (T850 !== null && T500 !== null) {
    var Dd700 = (T700 !== null && Td700 !== null) ? (T700 - Td700) : 30;
    var KI = (T850 - T500) + (Td850 !== null ? Td850 : 0) - Dd700;
    idxRows.push({ lbl: 'K-Index:', val: KI.toFixed(0), col: KI > 30 ? '#cc0000' : (KI > 20 ? '#cc7700' : '#333333') });
    idxRows.push({ lbl: 'T850-T500:', val: (T850 - T500).toFixed(1) + 'K', col: '#333333' });
  }
  if (T850  !== null) { idxRows.push({ lbl: 'T850:', val: T850.toFixed(1) + '°C', col: '#333333' }); }
  if (T700  !== null) { idxRows.push({ lbl: 'T700:', val: T700.toFixed(1) + '°C', col: '#333333' }); }
  if (T500  !== null) { idxRows.push({ lbl: 'T500:', val: T500.toFixed(1) + '°C', col: '#333333' }); }
  if (Td850 !== null) { idxRows.push({ lbl: 'Td850:', val: Td850.toFixed(1) + '°C', col: '#00aa00' }); }

  for (var ii = 0; ii < idxRows.length; ii++) {
    var row = idxRows[ii];
    ctx.fillStyle = '#555555'; ctx.fillText(row.lbl, idxX, idxY + ii * 14);
    ctx.fillStyle = row.col; ctx.textAlign = 'right';
    ctx.fillText(row.val, idxX + hodoR * 2 + 10, idxY + ii * 14);
    ctx.textAlign = 'left';
  }

  // タイトル
  ctx.textAlign = 'center'; ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#000000';
  ctx.fillText(title, PAD_L + plotW / 2, PAD_T - 10);

  // ボーダー
  ctx.strokeStyle = '#000000'; ctx.lineWidth = 1.5;
  ctx.strokeRect(PAD_L, PAD_T, plotW, plotH);

  // 凡例 (プロット内 左上)
  var lgItems = [
    { c: '#ff2200', l: 'Temperature' }, { c: '#00aa00', l: 'Dewpoint' },
    { c: '#aa44aa', l: 'Wetbulb' },    { c: '#009966', l: '0°C isotherm' },
    { c: '#8888cc', l: 'Pseudoadiabat' }, { c: '#cc8800', l: 'Dry Adiabat' }
  ];
  ctx.textAlign = 'left'; ctx.font = '8px sans-serif';
  var lgX = PAD_L + 4, lgY = PAD_T + 10;
  for (var ii = 0; ii < lgItems.length; ii++) {
    ctx.fillStyle = lgItems[ii].c; ctx.fillRect(lgX, lgY + ii * 11 - 6, 14, 2.5);
    ctx.fillStyle = '#333333'; ctx.fillText(lgItems[ii].l, lgX + 18, lgY + ii * 11);
  }

  // データソース注記
  ctx.textAlign = 'right'; ctx.font = '7px sans-serif'; ctx.fillStyle = '#aaaaaa';
  ctx.fillText('GFS / Open-Meteo', PAD_L + plotW - 2, PAD_T + plotH - 3);

  cb(canvas.toDataURL('image/png'));
}
```

### 1-2. `wxOfpDrawWindBarb(ctx, x, y, speed_kt, dir_deg)` を新規追加

`wxOfpDrawSkewt` の直前に追加する。既存コードに存在しない場合のみ追加。

```javascript
function wxOfpDrawWindBarb(ctx, x, y, speed_kt, dir_deg) {
  ctx.save();
  ctx.strokeStyle = '#222222'; ctx.fillStyle = '#222222';
  ctx.lineWidth = 1.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  if (speed_kt < 2.5) {
    ctx.beginPath(); ctx.arc(x, y, 4, 0, 2 * Math.PI); ctx.stroke();
    ctx.restore(); return;
  }

  var angle = (dir_deg - 90) * Math.PI / 180;
  var dx = Math.cos(angle), dy = Math.sin(angle);
  var perpX = -dy, perpY = dx;
  var shaftLen = 26, barbH = 10, spacing = 5;

  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * shaftLen, y + dy * shaftLen); ctx.stroke();

  var pn = Math.floor(speed_kt / 50);
  var rem = speed_kt - pn * 50;
  var fl = Math.floor(rem / 10); rem -= fl * 10;
  var hl = Math.round(rem / 5);

  var cx = x + dx * shaftLen, cy = y + dy * shaftLen;
  var sx = -dx * spacing, sy = -dy * spacing;

  for (var pi = 0; pi < pn; pi++) {
    var nx = cx + sx * 2, ny = cy + sy * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + perpX * barbH, cy + perpY * barbH); ctx.lineTo(nx, ny);
    ctx.closePath(); ctx.fill();
    cx = nx; cy = ny;
  }
  if (pn > 0) { cx += sx; cy += sy; }

  for (var fi = 0; fi < fl; fi++) {
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + perpX * barbH, cy + perpY * barbH); ctx.stroke();
    cx += sx; cy += sy;
  }
  for (var hi = 0; hi < hl; hi++) {
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + perpX * barbH * 0.5, cy + perpY * barbH * 0.5); ctx.stroke();
    cx += sx; cy += sy;
  }
  ctx.restore();
}
```

---

## 修正 2: WX SKEW-T タブのステーション変更 + Open-Meteo 化

### 2-1. 現状の確認
index.html 内で以下を検索して WX SKEW-T の実装を特定する:
```
シンガポール
WMO
47646
weather.uwyo.edu
```

現在のステーション定義（WMO コード等）を見つけたら、以下で完全置き換えする。

### 2-2. WX SKEW-T ステーション定義を以下に置き換え

```javascript
// WX SKEW-T 固定ステーション (Open-Meteo 用 lat/lon)
var WX_SKEWT_STATIONS = [
  { code: 'SIN', name: 'Singapore',       lat:  1.3521, lon: 103.8198 },
  { code: 'KUL', name: 'Kuala Lumpur',    lat:  2.7456, lon: 101.7099 },
  { code: 'SGN', name: 'Ho Chi Minh',     lat: 10.8188, lon: 106.6520 },
  { code: 'SYD', name: 'Sydney',          lat: -33.9399, lon: 151.1753 },
  { code: 'BKK', name: 'Bangkok',         lat: 13.6811, lon: 100.7479 },
  { code: 'TSA', name: 'Taipei Songshan', lat: 25.0694, lon: 121.5525 }
];
```

### 2-3. タブボタン HTML の更新

WX SKEW-T のタブボタン生成箇所（`シンガポール` や `KL` のボタンがある箇所）を探して、
`WX_SKEWT_STATIONS` を基に動的生成に変更するか、静的 HTML を以下に差し替える:

```html
<!-- WX SKEW-T サブタブ (6 局) -->
<button onclick="wxSkewtLoad('SIN')" id="wx-skewt-btn-SIN">SIN</button>
<button onclick="wxSkewtLoad('KUL')" id="wx-skewt-btn-KUL">KUL</button>
<button onclick="wxSkewtLoad('SGN')" id="wx-skewt-btn-SGN">SGN</button>
<button onclick="wxSkewtLoad('SYD')" id="wx-skewt-btn-SYD">SYD</button>
<button onclick="wxSkewtLoad('BKK')" id="wx-skewt-btn-BKK">BKK</button>
<button onclick="wxSkewtLoad('TSA')" id="wx-skewt-btn-TSA">TSA</button>
```

### 2-4. WX SKEW-T フェッチ関数を以下で置き換え

既存の Wyoming フェッチ関数（`wxSkewtFetch` `wxSkewtLoad` 等の名前）を探して、
以下の実装で置き換える。関数名は既存に合わせること。

```javascript
function wxSkewtLoad(code) {
  var st = null;
  for (var i = 0; i < WX_SKEWT_STATIONS.length; i++) {
    if (WX_SKEWT_STATIONS[i].code === code) { st = WX_SKEWT_STATIONS[i]; break; }
  }
  if (!st) { return; }

  // ボタンハイライト
  for (var i = 0; i < WX_SKEWT_STATIONS.length; i++) {
    var btn = document.getElementById('wx-skewt-btn-' + WX_SKEWT_STATIONS[i].code);
    if (btn) { btn.style.fontWeight = (WX_SKEWT_STATIONS[i].code === code) ? 'bold' : 'normal'; }
  }

  // 表示エリアに「取得中...」
  var container = document.getElementById('wx-skewt-container');
  if (container) { container.innerHTML = '<span style="color:#666;font-size:12px;">取得中...</span>'; }

  var LEVELS = [1000, 925, 850, 700, 600, 500, 400, 300, 250, 200, 150, 100];
  var vars = [];
  for (var li = 0; li < LEVELS.length; li++) {
    var lp = LEVELS[li];
    vars.push('temperature_' + lp + 'hPa');
    vars.push('dewpoint_' + lp + 'hPa');
    vars.push('windspeed_' + lp + 'hPa');
    vars.push('winddirection_' + lp + 'hPa');
    vars.push('geopotential_height_' + lp + 'hPa');
  }

  var targetHour = wxOfpCurrentHourIso();
  var apiUrl = 'https://api.open-meteo.com/v1/forecast'
    + '?latitude='  + st.lat.toFixed(4)
    + '&longitude=' + st.lon.toFixed(4)
    + '&hourly='    + vars.join(',')
    + '&models=gfs_seamless&forecast_days=2&timezone=UTC';

  var xhr = new XMLHttpRequest();
  xhr.open('GET', apiUrl, true);
  xhr.responseType = 'text';
  xhr.onload = function() {
    if (xhr.status === 200 && xhr.responseText) {
      var json;
      try { json = JSON.parse(xhr.responseText); } catch(e) { json = null; }
      if (json) {
        var levels = wxOfpParseOpenMeteo(json, targetHour);
        if (levels.length > 0) {
          var ttl = st.code + ' (' + st.name + ')  ' + targetHour + 'Z  GFS SKEW-T';
          wxOfpDrawSkewt(levels, ttl, function(dataUrl) {
            if (container) {
              var img = document.createElement('img');
              img.src = dataUrl;
              img.style.maxWidth = '100%';
              container.innerHTML = '';
              container.appendChild(img);
            }
          });
        } else {
          if (container) { container.innerHTML = '<span style="color:#f66">データなし (' + st.code + '  ' + targetHour + 'Z)</span>'; }
        }
      } else {
        if (container) { container.innerHTML = '<span style="color:#f66">JSON 解析エラー</span>'; }
      }
    } else {
      if (container) { container.innerHTML = '<span style="color:#f66">取得エラー HTTP ' + xhr.status + '</span>'; }
    }
  };
  xhr.onerror = function() {
    if (container) { container.innerHTML = '<span style="color:#f66">通信エラー</span>'; }
  };
  xhr.send();
}
```

> `wxOfpCurrentHourIso()` と `wxOfpParseOpenMeteo(json, targetHour)` は OFP SKEW-T 実装済みのものを流用する。

---

## 修正 3: 天気図 → 短期予報解説 HTTP 404

### 3-1. 調査手順
index.html で以下を検索して現在の URL を特定する:
```
短期予報解説
yohoushi
```

### 3-2. 対処
現在の URL を確認し、以下の優先順位で対応する:

**A) 固定画像 URL の場合 (日付なし):**
JMA の現在の 天気予報解説資料 ページから画像を取得する `wxFetchHtmlImage` 呼び出しに変更:
```javascript
// 変更後:
wxFetchHtmlImage('https://www.jma.go.jp/jp/yohoushi/', container);
```

**B) 日付入りの URL を生成している場合:**
日付フォーマットが JMA の現在の形式と一致しているか確認する。
JMA の 短期予報解説資料 は `https://www.jma.go.jp/jma/kishou/know/` 配下に移動した可能性がある。

**C) URL が完全に不明な場合:**
```javascript
container.innerHTML = '<a href="https://www.jma.go.jp/jp/yohoushi/" target="_blank"'
  + ' style="color:#5af">天気予報解説資料 (外部で開く)</a>';
```

---

## 修正 4: 衛星 → TSAS北 / TSAS南

### 4-1. 調査手順
index.html で以下を検索して TSAS 画像 URL を特定する:
```
TSAS
metair
tsas
```

### 4-2. 対処
TSAS 画像は `www3.metair.go.jp` から配信される。現在の URL パターンを確認し:
- URL が古いパス形式であれば `www3.metair.go.jp` の現在のパスに更新する
- 404 が続く場合は 国土交通省・気象庁の代替 URL を探す
- `wxFetchHtmlImage` で HTML ページから画像抽出に切り替えることも検討する

---

## 修正 5: 雨雲レーダー

### 5-1. 調査手順
index.html で以下を検索して URL パターンを特定する:
```
radar
radnowc
bosai
雨雲
```

### 5-2. 対処
JMA 雨雲レーダーの現在の URL 形式:

```javascript
// 方法 A: bosai nowcast タイルから最新画像を取得
// (時刻を現在時刻から計算して5分単位に丸める)
function wxRadarUrl() {
  var now = new Date();
  var utcMin = Math.floor(now.getUTCMinutes() / 5) * 5 - 10; // 10分前に丸め
  var d = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
    now.getUTCHours(), utcMin < 0 ? utcMin + 60 : utcMin
  ));
  if (utcMin < 0) { d = new Date(d.getTime() - 60 * 60 * 1000); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  var ts = '' + d.getUTCFullYear()
    + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate())
    + pad(d.getUTCHours()) + pad(d.getUTCMinutes());
  return 'https://www.jma.go.jp/bosai/img/nowc/radar/' + ts + '00-05-nowc.png';
}
```

上記 URL をプロキシ経由 (`WX_WORKER_PROXY + '?url=' + encodeURIComponent(url)`) で取得して `<img>` 表示する。

`www.jma.go.jp` はすでに `allowedHosts` に含まれているため Worker 変更不要。

---

## 修正 6: SIG → ABJP 下層悪天予想図

### 6-1. 調査手順
```
ABJP
下層悪天
airinfo
```
で検索して現在の URL を特定する。

### 6-2. 対処
JMA 航空気象 の下層悪天予想図 URL は `www.data.jma.go.jp` 配下:
```javascript
// 例: 試行する URL パターン
// https://www.data.jma.go.jp/airinfo/flt_prog/jp_sfc/jp_sfc.gif
// https://www.data.jma.go.jp/airinfo/chart/
```
上記を順に確認し、有効なものをプロキシ経由で表示する。
`www.data.jma.go.jp` は `allowedHosts` 済み。

---

## 修正 7: 火山

### 7-1. 調査手順
```
volcano
火山
```
で検索して URL を特定する。

### 7-2. 対処
JMA 火山監視画像の URL が変更されている可能性がある。
```javascript
// 現在の JMA 火山情報ページから画像抽出:
wxFetchHtmlImage('https://www.jma.go.jp/jp/volcano/', container);
```
または各火山のカメラ画像 URL を `www.data.jma.go.jp` から取得する。

---

## まとめ（Cursor への指示）

```
fix_wx_skewt_and_bugs.md の指示に従って index.html を修正してください。

【優先度 高 - 必須】
1. wxOfpDrawSkewt を Step 1 のライトテーマ版に完全置き換え
2. wxOfpDrawWindBarb を新規追加 (wxOfpDrawSkewt の直前)
3. WX SKEW-T: WX_SKEWT_STATIONS 定義を追加、タブを 6 局 (SIN/KUL/SGN/SYD/BKK/TSA) に変更
4. WX SKEW-T: wxSkewtLoad() を Open-Meteo 版に置き換え (Wyoming は廃止)

【優先度 中 - URL バグ修正】
5. 天気図「短期予報解説」404 → 修正 3 の手順で対処
6. 雨雲レーダー → wxRadarUrl() を使ったプロキシ経由 img 表示に変更
7. SIG「ABJP 下層悪天予想図」→ 修正 6 の URL パターンで試行
8. 火山 → 修正 7 の手順で対処

【優先度 低 - 要調査】
9. 衛星 TSAS北/南 → 修正 4 の手順で URL を特定・修正

ES5 厳守。既存の FLT PLN・NAVLOG・NOTAM ロジックは変更しないこと。
```
