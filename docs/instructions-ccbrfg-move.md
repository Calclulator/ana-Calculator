# 指示書：CC BRFG メニュー移設

対象ファイル: `index.html`

---

## 概要

現在 **Planning** セクションにある「👩‍✈️ CC BRFG」ボタンを
**Briefings & Tools** セクションに移設する。
Briefings & Tools には現在 WIP ボタン（`nav-dis` クラス）が存在するので、
それを機能するボタンに置換する。

---

## Step 1: Planning セクションから CC BRFG ボタンを削除

下記の行を削除（1行削除のみ）:

```html
      <button class="nav-item" id="nav-ccbrfg" onclick="navTo('ccbrfg')">👩‍✈️ CC BRFG</button>
```

---

## Step 2: Briefings & Tools の WIP ボタンを置換

現在:
```html
      <button class="nav-item nav-dis">📄 Cabin Crew BRFG<span class="nav-tag">WIP</span></button>
```

置換後:
```html
      <button class="nav-item" id="nav-ccbrfg" onclick="navTo('ccbrfg')">👩‍✈️ Cabin Crew BRFG</button>
```

---

## 確認事項

- Planning セクション: FLT PLN, MEMO, Holding の3つのみになっている
- Briefings & Tools セクション: 「👩‍✈️ Cabin Crew BRFG」をクリックすると CC BRFG パネルが開く
- WIP バッジが消えている
- Day/Night いずれの mode でもボタンが正常表示される
