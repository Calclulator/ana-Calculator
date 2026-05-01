# ana-Calculator

ANA パイロット向けのフライトプランニング補助ツール。
GitHub Pages で公開: https://calclulator.github.io/ana-Calculator/

## ファイル構成

`index.html` 一枚で完結する SPA。外部 JS/CSS ファイルは持たない(全て inline)。
唯一の例外は CDN 経由の Leaflet (地図) と pdf.js (PDF解析)。
ana-Calculator/
├── index.html              ← メインのアプリ本体(全コードここに inline)
├── CLAUDE.md               ← このファイル(AI 用の前提情報)
└── docs/
└── navlog-format.md    ← NAVLOG フォーマット仕様(ANA 公式 CFP 仕様書ベース)

## 機能概要

左上ハンバーガーメニューから2画面に切り替え:

- **Weather Radar**: Leaflet地図に航路、FIR、SIGMET、衛星画像、レーダー、グライド範囲、ETOPS リングを重畳表示
- **Flight Plan**: NAVLOG(テキスト or PDF)を解析して WP/ETP/代替空港/MLDW などを表形式で表示

メニューには出発地→目的地、現在UTC、両空港のLCL Time も表示。

## NAVLOG の読み方

詳細は `docs/navlog-format.md` 参照(ANA 公式 CFP 仕様書 EFF:2022.12.01 REV.65 ベース)。

要点だけ:
- WP行の座標形式: `[NS]\d{5}[EW]\d{6,7}` (例: `N35349E141433`)
- WP は「行A(座標+数値)」+「行B(WP名+数値)」の2行ペア
- `ALTERNATE DATA` / `ETP SUMMARY` / `EQUAL TIME POINT` / `DIVERSION SUMMARY` / `WINDS/TEMP ALOFT` 以降は WP として読まない
- 特殊 WP マーカー: `TOC`, `TOD`, `FIR`, `ETP1〜4`, `EEP1〜3`, `EXP1〜3`, `-CRP-`
- 重量関係: `PTOW = PZFW + FOB - TAX`、`PLDW = PTOW - BOF`
- 各 WP での重量 = `PZFW + Plan Remain Fuel`(Actual 入力時はそちら優先)
- FIR 境界の確実なソース: ATS FPL セクションの `EET/KZAK0206 ADIZ1545 ...`(時刻ベース)
- 燃料単位は lbs(DHC-8-Q400 は 10lb 丸め、その他は 100lb 丸め)
- 表示時は `/1000` して小数1桁(例: 380000 → 380.0)

### 機材コード
JetPlan 内部コード → ICAO の対応:
- `NH8A` = B788
- `NH8C` = B789
- `NH9K` = B77W / B773
- `NH9D` = B772
- `NHXK` = B77W (別系統)
- `NH7E` 等もあり(詳細は仕様書参照)

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
- MLDW 行: 背景 `rgba(255,152,0,.15)`、文字 `#ff9800`、▼ MLDW xxx.x 表示

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

## 既知の挙動

- FIR 色分けは VATSIM FIR GeoJSON のポリゴン判定で実装済み(iPad対応・バウンディングボックスインデックス使用)
- FIR 境界の二重線描画は実装済み(Day=青/Night=黄)
- メニューには出発地→目的地、UTC、両空港 LCL Time が表示される
- SAT TIME スライダーは右が最新、左に行くほど過去