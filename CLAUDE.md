# ana-Calculator

ANA パイロット向けのフライトプランニング補助ツール。
GitHub Pages で公開: https://calclulator.github.io/ana-Calculator/

## ファイル構成

`index.html` 一枚で完結する SPA。外部 JS/CSS ファイルは持たない(全て inline)。
唯一の例外は CDN 経由の Leaflet (地図) と pdf.js (PDF解析)。

## 機能概要

左上ハンバーガーメニューから2画面に切り替え:

- **Weather Radar**: Leaflet地図に航路、FIR、SIGMET、衛星画像、レーダー、グライド範囲、ETOPS リングを重畳表示
- **Flight Plan**: NAVLOG(テキスト or PDF)を解析して WP/ETP/代替空港/MLDW などを表形式で表示

## NAVLOG の読み方

ANA の Navigation Log フォーマットを `runParse` 関数で解析している。

### WP(ウェイポイント)
- 座標形式: `N35561E140151` (NS 5桁 + EW 6〜7桁)
- WP名は座標の次の行に出る (例: `ARIES`, `TT502`, `LOCUP`)
- `-KZAK`, `-PGZU` のように `-` で始まるものは **FIR境界マーカー**(WPではなくFIR切替を示す)

### パース終了条件
以下のセクションが現れたら WP の読み込みを止める:
- `ALTERNATE DATA`
- `ETP SUMMARY`
- `EQUAL TIME POINT`
- `DIVERSION SUMMARY`

### skipWords (WP名として誤検出しないリスト)
`FL, DEC, CLM, TOC, TOD, MLDW, R, RMG, P, ETP, EEP, EXP, PLAN, NML, STD, STA, BOF, CON, RSV, ALT, TAX, REQ, PCF, EXT, FOB, FOD` 等

### 重要な数値
- `PZFW xxxxxx` : Planned Zero Fuel Weight (kg)
- `FOB xxxxx`   : Fuel On Board (kg)
- `MLDW xxxxxx` : Max Landing Weight (kg)
- `PTOW = PZFW + FOB`
- 全て表示時は `/1000` して小数1桁(例: 380000 → 380.0)

### 機材コード
`NH8A=B788`, `NH8C=B789`, `NH9K=B77W/B773`, `NH9D=B772`, `NHXK` の対応あり。

### 出発・目的地
`RJTT-YSSY` のように `[A-Z]{4}-[A-Z]{4}` 形式で記載される。

## コード規約

**iPad Safari 対応のため ES5 で書く**:
- `var` を使う(`let`/`const` 不可)
- アロー関数禁止 → `function(x){...}` を使う
- テンプレートリテラル禁止 → 文字列連結 `'a'+b+'c'`
- `Array.prototype.forEach` は OK だが `for...of` は避ける
- `Promise.then()` は OK だが `async/await` は避ける(古い iPad で動かない場合あり)

## デザイン規約

- ベースは Night mode (暗背景 + 水色アクセント `#4fc3f7`)
- Day mode は `toggleMode` 関数内の `day-mode-style` で `!important` 上書き
- アクセントカラー: Day=`#1565c0`, Night=`#4fc3f7`
- 警告系: `#ff9800` (オレンジ), `#ef5350` (赤)

## デプロイ

GitHub Desktop で commit → push すると数分で GitHub Pages に反映。
キャッシュが残ることがあるのでハードリロード(Ctrl+Shift+R)で確認。

## 参考サイト

大元の参考サイト(機能を寄せたい): https://nq-calculator.vercel.app/

## 現在の進行中タスク

- [ ] MLDW 行の挿入(残燃料が MLDW を下回る WP 直前にオレンジ系の行を挿入)
- [ ] NEXRAD Radar の SAT TIME 対応(現在は最新のみ表示)
- [ ] BOM Radar の SAT TIME 対応(表示が不安定)

## 未着手の機能

- Atmosphere Analysis ページ
- SAT View ページ
- Crew Rest Calculator
- Curfew Calculator
- Cabin Crew BRFG