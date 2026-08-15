# ana-Calculator

ANA パイロット向けのフライトプランニング補助ツール。
GitHub Pages で公開: https://calclulator.github.io/ana-Calculator/

## Cowork セッション設定

**セッション開始時に毎回実行**: `C:\Users\nomad\OneDrive\ドキュメント\GitHub\ana-Calculator` をCoworkフォルダとして接続する。
proxy も必要な場合は `C:\Users\nomad\OneDrive\ドキュメント\GitHub\ana-Calculator-gfs-proxy` も接続する。

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
JetPlan 内部コード はプレフィックスで機体型式を、サフィックス(A/C/K等)でエンジン種別を示す:
- `NH8*` (NH8A, NH8C 等) = B787-8、メインタンク容量 79,094 lbs
- `NH9*` (NH9A, NH9C, NH9K, NH9D 等) = B787-9、メインタンク容量 78,384 lbs
- `NHX*` (NHXK, NHXA 等) = B787-10、メインタンク容量 78,384 lbs（B787-9 と同値）
- `NH7*` (NH7E, NH7K 等) = B767（燃料ダンプ不可）
- B777 は当面使用予定なし

コード判定は正規表現 `/^NH8/`, `/^NH9/`, `/^NHX/`, `/^NH7/` でプレフィックスマッチする。
NAVLOGパースの正規表現: `/\b(NH[0-9X][A-Z])\b/`

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
- [ ] A/P METAR の「データなし」問題（下記参照）

### A/P METAR 現状と経緯（重要）

**現状**: 一部空港でタップしても「METAR: データなし」が出る。

**これまでの変更**:
- CheckWX API（`eb52e4c6ca254584842adb8dc574b4f8`）がレート制限 or 部分データを返すため「データなし」が頻発
- aviationweather.gov を **プライマリ**に変更（`commit 9fc78c5`）→ 色付き円は表示されるようになった
- プレースホルダーマーカーのクリックハンドラーに **METARキャッシュ参照** を追加済み（`instructions-metar-popup-fix.md` を Cursor が適用済み）
- aviationweather.gov の `hours=2` → `hours=4` に変更済み（直接 index.html を編集、未 push の場合あり）

**残る問題の仮説**:
- aviationweather.gov は `hours=N` 以内のMETARのみ返す（CheckWXは最新1件を無条件返却）
- 一部空港（発報間隔が長い空港）が `hours=4` でも抜けるかもしれない
- `hours=4` で解決しない場合は、個別の空港ICAOコードを確認して対応する

**関連コード箇所**:
- `function apFetchAvwxMetar(icaos)` — avwx バルクフェッチ（line ~9427）
- `function loadMetarsForIcaosList(near, keepExistingLayers)` — プライマリ/セカンダリ切り替え（line ~9913）
- `function renderMetarMarkers(metarList, headers)` — 円+マーカー描画（line ~9741）
- プレースホルダークリックハンドラー — キャッシュ参照+avwx単件フェッチ（line ~9657）

### Cursor 実装待ち（指示書あり）

以下の指示書が `docs/` に用意済み。index.html への実装は Cursor で行う:

- [ ] `docs/instructions-holding-calc.md` — Holding Calculator 全面刷新
  - ICAO TABLE IV-1-1（Normal/Turbulence 2列）に修正
  - Taiwan を独立テーブル（FL別・1列）として分離
  - 全文日本語化、Day mode 対応
- [ ] `docs/instructions-day-mode-panels.md` — 動的パネルの Day mode 対応
  - `getDayColors()` ヘルパー追加
  - Holding / Dump / Curfew / CC BRFG 各パネルの再描画に適用
  - `toggleMode()` でアクティブパネルを再描画
- [ ] `docs/instructions-ccbrfg-move.md` — CC BRFG をメニュー移設
  - Planning → Briefings & Tools へ移動
  - WIP ボタンを機能ボタンに置換
- [ ] `docs/instructions-ato-recalc.md` — ATO 手動編集時の後続 WP 再計算
  - `recalcSubsequentAtos()` 関数追加
  - `onAtoChange()` から呼び出し
- [ ] `docs/instructions-time-to-dump.md` — Time to Dump 機材コード修正
  - `DUMP_PARAMS` オブジェクト削除 → `getDumpParams()` 関数に置換
  - NH8C=B787-8、NH9K/NH9D=B787-9、NHXK=B787-10 に修正
  - NAV_ACFT_CODE 正規表現を汎用化

## 未着手の機能

- Atmosphere Analysis ページ
- SAT View ページ
- Crew Rest Calculator

## 既知の挙動

- FIR 色分けは VATSIM FIR GeoJSON のポリゴン判定で実装済み(iPad対応・バウンディングボックスインデックス使用)
- FIR 境界の二重線描画は実装済み(Day=青/Night=黄)
- メニューには出発地→目的地、UTC、両空港 LCL Time が表示される
- SAT TIME スライダーは右が最新、左に行くほど過去
- WP ラベルは全件 `permanent:true` で常時表示（キー WP は大きめフォント、非キー WP は 9px・75%透明度）
- ATO 列ヘッダーに「反映」ボタンあり。バックグラウンドから復帰時も `visibilitychange` で自動反映
- NOTAM PDF アップロード対応。座標ベースと R/D/P 空域識別符（OpenAIP API 経由）をマップ表示
- OpenAIP API キー: `81b014bd2dc31293a446b1562a028a72`（`OPENAIP_API_KEY` 変数に設定済み）
- A/P METAR: aviationweather.gov プライマリ（`hours=4`）、CheckWX セカンダリ