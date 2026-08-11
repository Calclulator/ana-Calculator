# Cursor指示書: NOTAM テキスト抽出精度の修正 (index.html)

ES5制約厳守。`parseNotamText` 関数の fullText・title 抽出を修正する。

---

## 問題

1. **タイトルが "AREA NOTAM" になる** — タイトル正規表現が `before` テキストの末尾($)のみを見るため、
   タイトル行と座標の間に長い本文があると検出できない。
   また検索ウィンドウが 500文字では足りない場合がある。

2. **全文に無関係な内容が混入** — 座標後を固定 500文字取るため、
   次の NOTAM（GPS RAIM 等）まで含んでしまう。
   修正: `TIL-XX/XX ... (XXXX)` パターンで末尾を確定させる。

---

## 変更箇所: `parseNotamText` 関数内の title・fullText 抽出部分を置き換える

### 探す（現在のコード）

```javascript
    // タイトル: 座標直前の最大 400文字から末尾のキーワード行を抽出
    before = rawText.substring(Math.max(0, firstIdx - 500), firstIdx);
    titleM = before.match(
      /((?:JASDF\s+)?(?:EXER\s+ACT|DANGER\s+AREA|WARNING[\s\-]+EXER|MISSILE[^\n]{0,40}LAUNCH|RESTRICTED\s+AREA|LASER[^\n]{0,30})[^\n]{0,80})\s*$/i
    );
    title = titleM ? titleM[1].replace(/\s+/g,' ').trim() : 'AREA NOTAM';

    // 有効期限: 座標後の 400文字から TIL-MM/DD または TIL-MM/DD を検索
    after = rawText.substring(lastIdx, lastIdx + 500);
    tilM  = after.match(/TIL[\-\s]*(\d{2}\/\d{2}(?:\s+\d{4})?)/);
    validity = tilM ? 'TIL ' + tilM[1] : '';

    // NOTAM全文 (前後 500文字)
    fullText = rawText.substring(Math.max(0, firstIdx - 500), lastIdx + 500).trim();
```

### 置き換え（修正後のコード）

```javascript
    // ── タイトル抽出 ──────────────────────────────────────────────────
    // 座標直前 800文字を検索対象とし、$アンカーなしでキーワードを探す
    // (タイトルと座標の間に長い本文があっても検出できるように)
    before = rawText.substring(Math.max(0, firstIdx - 800), firstIdx);
    titleM = before.match(
      /(JASDF\s+EXER\s+ACT[^\n]{0,100}|DANGER\s+AREA[^\n]{0,80}|WARNING[\s\-]+EXER[^\n]{0,80}|MISSILE[^\n]{0,30}LAUNCH[^\n]{0,60}|RESTRICTED\s+AREA[^\n]{0,80}|LASER[^\n]{0,60})/i
    );
    if(titleM) {
      title = titleM[1].replace(/\s+/g, ' ').trim();
      // 末尾の余分な単語を除去 (座標・数字で終わる部分をカット)
      title = title.replace(/\s+[\d\(].*$/, '').trim();
    } else {
      // フォールバック: before の最後の英大文字フレーズ (括弧・数字を除く)
      var lastPhrase = before.match(/([A-Z][A-Z\s\/\-\.]+)\s*$/);
      title = lastPhrase ? lastPhrase[1].replace(/\s+/g,' ').trim() : 'AREA NOTAM';
    }

    // ── 有効期限抽出 ──────────────────────────────────────────────────
    after = rawText.substring(lastIdx, lastIdx + 600);
    tilM  = after.match(/TIL[\-\s]*(\d{2}\/\d{2}(?:[^\n]{0,30})?)/);
    validity = tilM ? 'TIL ' + tilM[1].replace(/\s+/g,' ').trim() : '';

    // ── fullText: 末尾を NOTAM番号/場所コードで確定させる ─────────────
    // "TIL-XX/XX ... (XXXX)" または "TIL-XX/XX XXXXXXXX/26 (XXXX)" の直後を末尾とする
    // これにより次の NOTAM の内容が混入しない
    var endBoundaryM = after.match(
      /TIL[\-\s]*\d{2}\/\d{2}[^\n]{0,60}?\([A-Z]{2,8}\)/
    );
    var endOffset;
    if(endBoundaryM) {
      endOffset = endBoundaryM.index + endBoundaryM[0].length;
    } else {
      // TIL行が取れない場合は座標末尾から最大 300文字
      endOffset = Math.min(300, after.length);
    }
    fullText = rawText.substring(Math.max(0, firstIdx - 400), lastIdx + endOffset).trim();
```

---

## 修正の効果

| 問題 | 修正前 | 修正後 |
|------|--------|--------|
| タイトル検索範囲 | 座標前 500文字・末尾($)のみ | 座標前 800文字・任意位置 |
| タイトル未検出時 | "AREA NOTAM" 固定 | 直前フレーズを使用 |
| fullText 末尾 | 固定 +500文字 | TIL+NOTAM番号 `(XXXX)` で確定 |
| 次 NOTAM 混入 | 発生する | 発生しない |

---

## コミット手順

```
git add index.html
git commit -m "fix: NOTAM fullText末尾をTIL+番号で確定・タイトル検索範囲を拡大"
git push origin main
```
