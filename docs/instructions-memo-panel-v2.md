# 指示書：MEMO パネル追加修正

対象ファイル: `index.html`
ES5厳守（var, function宣言, 文字列連結のみ）

前回の `instructions-memo-panel.md` Step 5 の `buildMemoText` / `renderMemoPanel` を以下に丸ごと置き換える。

---

## 変更概要

① FOD行末尾に「FOD − RSV+ALT合算」の差を数字のみ追加  
② PTOW/MLDW行末尾に差(klbs)と 3000lbs/min 換算の繰り上げmin を追加  
③ RMK行にNAVLOGのPAX数を転載  
④ WX行に目的地の最低/最高気温と天気記号を非同期で自動入力（wttr.in使用・APIキー不要）

---

## 期待出力例

```
2026/07/17  ANA0880 YSSY→RJTT
1055Z	2045Z
09+50	09+10 (40min)			SS: — / SR: 1927Z
RJGG	12.8 (RSV:4.3/ALT:8.5)
FOB:	120.5	FOD: 22.7	9.9
PTOW: 424.3	MLDW: 425.0	0.7 (1min)
RMK: PAX 280
Turbulence:
WX: 12/21℃ ○
```

- `FOD: 22.7` の後の `9.9` = FOD(22.7) − RSV+ALT合算(12.8)
- `MLDW: 425.0` の後の `0.7 (1min)` = |MLDW−PTOW|(klbs) と ceil(差lbs/3000)
- `RMK: PAX 280` はNAVLOGから取得したPAX数
- `WX: 12/21℃ ○` は目的地の最低/最高気温と天気記号（○晴れ／△曇り／R雨）

---

## Step 5 置き換え全文

`clearFpl` 関数の直前にある `buildMemoText` / `renderMemoPanel` を以下で丸ごと置き換える:

```javascript
function fetchDestWeather(cb) {
  if(!NAV_DEST) { cb(''); return; }
  var apt = typeof APT !== 'undefined' ? APT[NAV_DEST] : null;
  if(!apt) { cb(''); return; }
  var url = 'https://wttr.in/' + apt.lat.toFixed(4) + ',' + apt.lon.toFixed(4) + '?format=j1';
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.timeout = 5000;
  xhr.onreadystatechange = function() {
    if(xhr.readyState !== 4) return;
    if(xhr.status !== 200) { cb(''); return; }
    try {
      var data = JSON.parse(xhr.responseText);
      var today = data.weather[0];
      var minC = today.mintempC;
      var maxC = today.maxtempC;
      // 昼間(hourly[4]=12:00頃)の天気を参照
      var desc = (today.hourly && today.hourly[4] && today.hourly[4].weatherDesc && today.hourly[4].weatherDesc[0])
        ? today.hourly[4].weatherDesc[0].value : '';
      var dl = desc.toLowerCase();
      var wx = '○';
      if(dl.indexOf('rain') >= 0 || dl.indexOf('shower') >= 0 || dl.indexOf('drizzle') >= 0
          || dl.indexOf('snow') >= 0 || dl.indexOf('sleet') >= 0 || dl.indexOf('thunder') >= 0) {
        wx = 'R';
      } else if(dl.indexOf('cloud') >= 0 || dl.indexOf('overcast') >= 0 || dl.indexOf('mist') >= 0
          || dl.indexOf('fog') >= 0 || dl.indexOf('haze') >= 0 || dl.indexOf('partly') >= 0) {
        wx = '△';
      }
      cb(minC + '/' + maxC + '℃ ' + wx);
    } catch(e) { cb(''); }
  };
  xhr.ontimeout = function() { cb(''); };
  xhr.send();
}

function buildMemoText() {
  function klbs(lbs) {
    if(lbs === null || lbs === undefined) return '—';
    return (lbs / 1000).toFixed(1);
  }
  function hhmm(str) {
    if(!str) return '—';
    return str.replace(':', '+');
  }
  var lines = [];

  // 1行目: 日付  便名 出発→到着
  var now = new Date();
  var dd = now.getUTCFullYear() + '/'
    + ('0'+(now.getUTCMonth()+1)).slice(-2) + '/'
    + ('0'+now.getUTCDate()).slice(-2);
  var fltNo = NAV_FLT_NO || '';
  var route = (NAV_DEP && NAV_DEST) ? (' ' + NAV_DEP + '→' + NAV_DEST) : '';
  lines.push(dd + (fltNo ? ('  ' + fltNo) : '') + route);

  // 2行目: STDhhmZ タブ STAhhmZ
  var stdStr = NAV_STD ? (NAV_STD.slice(0,2)+NAV_STD.slice(2)+'Z') : '—';
  var staStr = NAV_STA ? (NAV_STA.slice(0,2)+NAV_STA.slice(2)+'Z') : '—';
  lines.push(stdStr + '\t' + staStr);

  // 3行目: B/T タブ F/T(差) タブ×3 SS/SR
  var btStr = hhmm(NAV_BT_STR);
  var ftStr = hhmm(NAV_FT_STR);
  var diffStr = '';
  if(NAV_BT_STR && NAV_FT_STR) {
    var bp = NAV_BT_STR.split(':'), fp2 = NAV_FT_STR.split(':');
    var d = (parseInt(bp[0])*60+parseInt(bp[1])) - (parseInt(fp2[0])*60+parseInt(fp2[1]));
    diffStr = ' (' + d + 'min)';
  }
  var ssStr = 'SS: ' + (NAV_SS_STR || '—') + ' / SR: ' + (NAV_SR_STR || '—');
  lines.push(btStr + '\t' + ftStr + diffStr + '\t\t\t' + ssStr);

  // 4行目: ALT空港 タブ RSV+ALT合計(RSV:x/ALT:y) [EDCT]
  var rsvVal = klbs(NAV_RSV_LBS);
  var altVal = klbs(NAV_ALT_LBS);
  var altApt = NAV_ALT_APT || '—';
  var rsvAltTotalKlbs = (NAV_RSV_LBS !== null && NAV_ALT_LBS !== null)
    ? (NAV_RSV_LBS + NAV_ALT_LBS) / 1000 : null;
  var rsvAltTotalStr = rsvAltTotalKlbs !== null ? rsvAltTotalKlbs.toFixed(1) : '—';
  var line4 = altApt + '\t' + rsvAltTotalStr + ' (RSV:' + rsvVal + '/ALT:' + altVal + ')';
  if(NAV_EDCT_STR) line4 += '  EDCT: ' + NAV_EDCT_STR;
  lines.push(line4);

  // 5行目: FOB: タブ 値 タブ FOD: 値 タブ (FOD−RSV+ALT差)
  var fodDiff = '';
  if(NAV_FOD_LBS !== null && rsvAltTotalKlbs !== null) {
    var fodKlbs = NAV_FOD_LBS / 1000;
    fodDiff = '\t' + (fodKlbs - rsvAltTotalKlbs).toFixed(1);
  }
  lines.push('FOB:\t' + klbs(NAV_FOB_LBS) + '\tFOD: ' + klbs(NAV_FOD_LBS) + fodDiff);

  // 6行目: PTOW: 値 タブ MLDW: 値 タブ 差(klbs) (繰上げmin)
  var ptowKlbs = NAV_PTOW_LBS !== null ? NAV_PTOW_LBS / 1000 : null;
  var ptowVal = ptowKlbs !== null ? ptowKlbs.toFixed(1) : '—';
  var mldwVal = NAV_MLDW !== null ? NAV_MLDW.toFixed(1) : '—';
  var wtDiffStr = '';
  if(ptowKlbs !== null && NAV_MLDW !== null) {
    var wtDiffKlbs = Math.abs(NAV_MLDW - ptowKlbs);
    var wtDiffLbs = wtDiffKlbs * 1000;
    var burnMin = Math.ceil(wtDiffLbs / 3000);
    wtDiffStr = '\t' + wtDiffKlbs.toFixed(1) + ' (' + burnMin + 'min)';
  }
  lines.push('PTOW: ' + ptowVal + '\tMLDW: ' + mldwVal + wtDiffStr);

  // 7行目: RMK (PAX数を転載)
  lines.push('RMK:' + (NAV_PAX !== null ? ' PAX ' + NAV_PAX : ''));

  lines.push('Turbulence:');
  lines.push('WX:');

  return lines.join('\n');
}

function renderMemoPanel() {
  var ta = document.getElementById('memo-textarea');
  if(!ta) return;
  if(!NAV_DEP && !NAV_DEST) {
    ta.value = '（NAVLOGを適用すると自動入力されます）\n\nRMK:\nTurbulence:\nWX:';
    return;
  }
  ta.value = buildMemoText();
  // 天気を非同期取得してWX行を更新
  fetchDestWeather(function(wxStr) {
    if(!wxStr) return;
    var lines = ta.value.split('\n');
    for(var i = 0; i < lines.length; i++) {
      if(lines[i] === 'WX:' || lines[i].indexOf('WX:') === 0) {
        lines[i] = 'WX: ' + wxStr;
        break;
      }
    }
    ta.value = lines.join('\n');
  });
}
```

---

## 天気記号の判定ロジック

| 記号 | 条件（英語天気説明に含まれる語） |
|---|---|
| R | rain, shower, drizzle, snow, sleet, thunder |
| △ | cloud, overcast, mist, fog, haze, partly |
| ○ | それ以外（晴れ・clear等） |

---

## 動作の注意

- 天気取得は非同期のため、MEMO表示直後は `WX:` のまま、1〜2秒後に更新される
- wttr.in がタイムアウト(5秒)またはエラーの場合は `WX:` のまま（手動入力可）
- 「↺ 再生成」ボタンで再度天気取得を試みる
- APT辞書に目的地がない場合は天気取得をスキップ

---

## 変更不要な箇所

Step 1〜4, Step 6〜8 は前回の `instructions-memo-panel.md` のまま変更なし。
