# 指示書：FR24 便名フォーマット修正

対象ファイル: `index.html`
ES5厳守（var, function宣言, 文字列連結のみ）

---

## 問題

- `flightradar24://` URLスキームはFR24アプリに対応していないため、Chrome（Webブラウザ）で開く
- NAVLOGから取得した便名が `ANA0880` 形式（先頭ゼロあり）のため、FR24 Web が "Live Flight not found" になる
- FR24 Webが期待する形式は `ANA880`（先頭ゼロなし）

---

## 修正箇所

`openFR24()` 関数を丸ごと以下に置き換える:

**変更前:**
```javascript
function openFR24() {
  var webUrl = 'https://www.flightradar24.com/' + (NAV_FLT_NO ? NAV_FLT_NO.toUpperCase() : '');
  var t = setTimeout(function() {
    window.open(webUrl, '_blank');
  }, 1500);
  document.addEventListener('visibilitychange', function onHide() {
    if(document.hidden) {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', onHide);
    }
  });
  window.location.href = 'flightradar24://';
}
```

**変更後:**
```javascript
function openFR24() {
  // 便名の先頭ゼロを除去 (ANA0880 → ANA880, ANA0006 → ANA6)
  var fltNoWeb = '';
  if(NAV_FLT_NO) {
    var m = NAV_FLT_NO.match(/^([A-Z]+)(\d+)$/);
    fltNoWeb = m ? (m[1] + String(parseInt(m[2], 10))) : NAV_FLT_NO;
  }
  var webUrl = 'https://www.flightradar24.com/' + fltNoWeb;
  window.open(webUrl, '_blank');
}
```

---

## 変更の理由

- URLスキーム (`flightradar24://`) はFR24に未対応のためシンプルな `window.open` に戻す
- `parseInt` で先頭ゼロを除去: `ANA0880` → `ANA880`

---

## 確認

FR24ボタンをタップして `https://www.flightradar24.com/ANA880` のようにゼロなし形式のURLが開き、フライト情報が表示されること。
