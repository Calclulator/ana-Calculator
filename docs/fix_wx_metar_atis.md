# 修正指示書: WX METAR/TAF ステーション変更 + ATIS 追加

**ES5 厳守 (var / function のみ)。既存の FLT PLN・NAVLOG・NOTAM ロジックは変更しないこと。**

---

## 修正 1: METAR/TAF ステーション一覧を変更

### 1-1. 調査
index.html 内で以下を検索して現在の WX METAR/TAF ステーション定義を特定する:
```
RJTT
METAR
wxMetar
wx-metar
```

### 1-2. ステーション定義を以下に置き換え

現在のステーション配列（ICAO コードのリストまたはオブジェクト配列）を探して、
以下で完全置き換えする。変数名は既存のものに合わせること。

```javascript
var WX_METAR_STATIONS = [
  { code: 'RJTT', name: 'Tokyo Haneda' },
  { code: 'RJAA', name: 'Tokyo Narita' },
  { code: 'RJBB', name: 'Osaka Kansai' },
  { code: 'ROAH', name: 'Naha' },
  { code: 'RCSS', name: 'Taipei Songshan' },
  { code: 'VVTS', name: 'Ho Chi Minh' },
  { code: 'VVDN', name: 'Da Nang' },
  { code: 'VTBS', name: 'Bangkok' },
  { code: 'WSSS', name: 'Singapore' },
  { code: 'WMKK', name: 'Kuala Lumpur' },
  { code: 'RPLL', name: 'Manila' },
  { code: 'VHHH', name: 'Hong Kong' },
  { code: 'WBKK', name: 'Kota Kinabalu' }
];
```

### 1-3. タブボタンの更新
METAR/TAF の空港選択ボタン生成箇所を `WX_METAR_STATIONS` から動的生成するか、
または静的 HTML を上記 13 局に合わせて更新する。

---

## 修正 2: METAR/TAF 表示部に ATIS を追加

### 2-1. ATIS 取得元
```
https://atis.guru/atis/{ICAO}
```
HTML ページを Cloudflare Worker プロキシ経由で取得し、テキストを抽出する。

### 2-2. Cloudflare Worker への `atis.guru` 追加

`wx-proxy/worker.js` の `allowedHosts` 配列に `atis.guru` を追加する:

```javascript
// 変更前の allowedHosts に以下を追加:
'atis.guru',
```

追加後、Cloudflare ダッシュボードで **Save and deploy** する。

### 2-3. ATIS フェッチ関数を追加

既存の `wxFetchHtmlImage` や METAR フェッチ関数の近くに以下を追加する:

```javascript
function wxFetchAtis(icao, containerId) {
  var container = document.getElementById(containerId);
  if (!container) { return; }
  container.innerHTML = '<span style="color:#888;font-size:11px;">ATIS 取得中...</span>';

  var url = 'https://atis.guru/atis/' + icao;
  var proxyUrl = WX_WORKER_PROXY + '?url=' + encodeURIComponent(url);

  var xhr = new XMLHttpRequest();
  xhr.open('GET', proxyUrl, true);
  xhr.responseType = 'text';
  xhr.onload = function() {
    if (xhr.status === 200 && xhr.responseText) {
      var html = xhr.responseText;
      // <pre> タグ内のテキストを抽出 (atis.guru は ATIS テキストを <pre> で返す)
      var preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
      var atisText = '';
      if (preMatch) {
        atisText = preMatch[1].replace(/<[^>]+>/g, '').trim();
      }
      // フォールバック: <div class="atis"> や data-atis 属性
      if (!atisText) {
        var divMatch = html.match(/class="atis[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        if (divMatch) { atisText = divMatch[1].replace(/<[^>]+>/g, '').trim(); }
      }
      // さらにフォールバック: <body> テキスト全体から ATIS らしい行を抽出
      if (!atisText) {
        var bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
          var bodyText = bodyMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          // ATIS は ICAO コードで始まることが多い
          var atisLine = bodyText.match(new RegExp('(' + icao + '[\\s\\S]{20,600})', 'i'));
          if (atisLine) { atisText = atisLine[1].trim(); }
          else { atisText = bodyText.substring(0, 600); }
        }
      }
      if (atisText) {
        container.innerHTML =
          '<div style="font-family:monospace;font-size:11px;white-space:pre-wrap;'
          + 'background:#f5f5f0;border:1px solid #ccc;padding:6px;border-radius:3px;'
          + 'color:#111;line-height:1.5;">' + atisText.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>';
      } else {
        container.innerHTML = '<span style="color:#888;font-size:11px;">ATIS データなし (' + icao + ')</span>';
      }
    } else {
      container.innerHTML = '<span style="color:#f66;font-size:11px;">ATIS 取得エラー HTTP ' + xhr.status + '</span>';
    }
  };
  xhr.onerror = function() {
    container.innerHTML = '<span style="color:#f66;font-size:11px;">ATIS 通信エラー</span>';
  };
  xhr.send();
}
```

### 2-4. METAR/TAF 表示エリアに ATIS セクションを追加

現在 METAR/TAF を表示している関数（`wxLoadMetar` `wxShowMetar` 等）を特定し、
METAR/TAF の表示完了後に ATIS を追加ロードするよう修正する。

#### パターン A: コンテナ構造を変更する場合

METAR/TAF コンテナの HTML に ATIS 用 `<div>` を追加し、
ATIS フェッチを METAR/TAF ロードと同時に呼び出す:

```javascript
// METAR/TAF ロード関数内（既存の METAR XHR 送信の直前/直後）に追加:
var atisContainerId = 'wx-atis-' + icao;
// コンテナが無ければ作る
var atisDiv = document.getElementById(atisContainerId);
if (!atisDiv) {
  atisDiv = document.createElement('div');
  atisDiv.id = atisContainerId;
  atisDiv.style.marginTop = '8px';
  // 既存の METAR/TAF コンテナの親 or 兄弟に appendChild
  var metarContainer = document.getElementById('wx-metar-container'); // 実際の ID に合わせる
  if (metarContainer && metarContainer.parentNode) {
    metarContainer.parentNode.appendChild(atisDiv);
  }
}
wxFetchAtis(icao, atisContainerId);
```

#### パターン B: 既存コンテナの末尾に追記する場合

METAR/TAF の表示が完了した直後（コールバックまたは XHR onload 内）に:

```javascript
// METAR/TAF 表示完了後:
var atisSection = document.createElement('div');
atisSection.style.marginTop = '10px';
atisSection.innerHTML = '<div style="font-size:11px;font-weight:bold;color:#333;margin-bottom:3px;">ATIS</div>'
  + '<div id="wx-atis-inline-' + icao + '"></div>';
container.appendChild(atisSection);
wxFetchAtis(icao, 'wx-atis-inline-' + icao);
```

### 2-5. ATIS ヘッダーラベルの追加

METAR/TAF と ATIS を視覚的に区別するため、各セクションに小見出しを付ける:

```javascript
// METAR セクションの直前:
'<div style="font-size:11px;font-weight:bold;color:#333;margin-bottom:2px;border-bottom:1px solid #ccc;">METAR / TAF</div>'

// ATIS セクションの直前:
'<div style="font-size:11px;font-weight:bold;color:#333;margin:8px 0 2px;border-bottom:1px solid #ccc;">ATIS</div>'
```

---

## 修正 3: 一括取得への組み込み（オプション）

WX の一括取得ボタンが METAR/TAF を取得している場合、ATIS も同時に取得するよう追記する。

一括取得ループ内で `wxFetchAtis(icao, containerId)` を呼び出す。
ATIS は非同期で問題ない（進捗カウントには含めなくてよい）。

---

## まとめ（Cursor への指示）

```
fix_wx_metar_atis.md の指示に従って index.html と wx-proxy/worker.js を修正してください。

【必須】
1. WX_METAR_STATIONS を 13 局 (RJTT/RJAA/RJBB/ROAH/RCSS/VVTS/VVDN/VTBS/WSSS/WMKK/RPLL/VHHH/WBKK) に更新
2. wx-proxy/worker.js の allowedHosts に 'atis.guru' を追加
3. wxFetchAtis(icao, containerId) 関数を追加
4. METAR/TAF 表示エリアに ATIS セクションを追加（パターン A or B、実装に合わせて選択）

【デプロイ】
- worker.js 変更後、Cloudflare ダッシュボードで Save and deploy を実行

ES5 厳守。既存の FLT PLN・NAVLOG・NOTAM ロジックは変更しないこと。
```
