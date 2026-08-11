# 指示書：FR24ボタン → iPadアプリ起動を試みる

対象ファイル: `index.html`
ES5厳守（var, function宣言, 文字列連結のみ）

---

## 変更箇所

`openFR24()` 関数（現在 `window.open(url, '_blank')` で終わっている）を以下に丸ごと置き換える。

**変更前:**
```javascript
function openFR24() {
  var base = 'https://www.flightradar24.com/';
  var url;
  if(NAV_FLT_NO) {
    url = base + NAV_FLT_NO.toUpperCase();
  } else {
    url = base;
  }
  window.open(url, '_blank');
}
```

**変更後:**
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

---

## 動作仕様

| 状況 | 動作 |
|---|---|
| FR24アプリがインストール済み・URLスキーム対応 | アプリが起動。1.5秒タイマーはキャンセルされWebは開かない |
| FR24アプリが未インストール or スキーム非対応 | 1.5秒後にブラウザの別タブでFR24ウェブを開く（従来動作） |

---

## 確認

iPadのSafariでFR24ボタンをタップし、FR24アプリが起動するかを確認する。
起動しない場合はFR24がURLスキームに対応していないため、ウェブフォールバックで動作する。
