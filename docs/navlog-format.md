# ANA NAVLOG (Computed Flight Plan) フォーマット仕様

ANA の Computed Flight Plan (CFP) の構造を定義したリファレンス。
ana-Calculator の `runParse` 関数が解析する対象。

公式仕様: ANA Operations Control Guidelines Appendix 4 (EFF: 2022.12.01, REV.65)

---

## 1. プラン種別

CFP には複数の種別があり、ヘッダの `xxx PLAN` で識別される:

| 種別 | 表記 | 用途 |
|---|---|---|
| Normal | `NML PLAN` | 通常便、Contingency 120分プラン |
| ETOPS | `ETOPS/120 PLAN`, `ETOPS/180 PLAN`, `ETOPS/207 PLAN` | ETOPS便 |
| Reclear | `RCLR PLAN` | Reclear 運航 |
| Tanker | `NML/TANKER` | Tanker (給油地経由) |
| 複合 | `RCL/TANKER PLAN R/F xxxxx` | Tanker + Reclear |

Long Plan か Short Plan かはレイアウトで判別。本ドキュメントは Long Plan を主に扱う。

---

## 2. ヘッダ (NAVIGATION LOG / 1行目)

```
NAVIGATION LOG
            JDP:PN000280 COMPUTED 1254Z JA782A NH7E 80/F 23FEB01
ANA0006/50/23  RJAA-KLAX  KONT/         STD 0815Z/1715L STA 1750Z/0950L
NML PLAN                                B/T 09HR35MIN F/T 08HR49MIN
                                        SS : / T SR17:33/099T
                                        EDCT:
COMPANY CLEARANCE
```

| 項目 | 例 | 意味 |
|---|---|---|
| JDP | `PN000280` | Jeppesen 内部プラン番号 (PN+4-7桁) |
| COMPUTED | `1254Z` | 計算時刻 (UTC) |
| 機番 | `JA782A` | Registration Number |
| JetPlan ACFT | `NH7E` | JetPlan 内部機材コード |
| Cruise Mode | `80/F` | Cost Index / モード(F=Fuel save, T=Time save, M=Cost Index) |
| 日付 | `23FEB01` | ddmmmyy |
| 便番号 | `ANA0006/50/23` | 便番号/プランコード/日付 |
| 出発-到着 | `RJAA-KLAX` | 出発空港 ICAO - 到着空港 ICAO |
| 代替 | `KONT/` | ALTN1 / ALTN2 (`/` 区切り) |
| STD | `0815Z/1715L` | Sched Time of Departure (UTC/Local) |
| STA | `1750Z/0950L` | Sched Time of Arrival (UTC/Local) |
| プラン種別 | `NML PLAN` | 上記表参照 |
| B/T | `09HR35MIN` | Block Time |
| F/T | `08HR49MIN` | Flight Time (= 各 LEG の ETE 合計を分丸め。BOF time = 秒ベース合計) |
| SS / SR | `SS : / T SR17:33/099T` | Sun Set / Sun Rise time + True Bearing (STD+10min基準) |
| EDCT | (時刻 or 空) | Estimated Departure Clearance Time (発行されている場合のみ) |

---

## 3. FUEL PLAN

```
-FUEL PLAN
        TIME  FUEL    TIME  FUEL              FUEL
BOF KLAX 08/49 187000 KLAX 00/00 000000  NO ADD F CONFIRMED
CON      00/33 009400      00/00 000000
RSV      00/30 008300      00/00 000000
ALT KONT 00/28 009700      00/00 000000
TAX      002400            000000
REQ      10/20 216800      00/00 000000
PCF      00/00 000000      00/00 000000
EXT      00/00 000000      00/00 000000
FOB      10/20 216800      00/00 000000
FOD=027400LB             TKOF ALTN....
```

各行: ラベル + (空港 ICAO) + TIME(HH/MM) + FUEL(6桁)
2列ある: 1列目=ALTN1向け、2列目=ALTN2向け (使わなければ全 0)

| ラベル | 意味 |
|---|---|
| BOF | Burn Off Fuel (出発地→目的地まで燃焼分) |
| CON | Contingency (10%通常)。実際の値は PCF と分けて管理 |
| RSV | Reserve fuel (Final reserve, 通常 30min) |
| ALT | Alternate fuel (目的地→ALTN1) |
| TAX | Taxi fuel |
| REQ | Required fuel (BOF+CON+RSV+ALT+TAX) |
| PCF | Planned Contingency Fuel (10%以外で計画した場合のみ) |
| EXT | Extra fuel |
| **FOB** | **Fuel On Board = REQ + EXT (= TAKEOFF FUEL)** |
| FOD | Fuel Over Destination = FOB - TAX - BOF |

**燃料単位**: 通常 lbs (DHC-8-Q400 のみ 10lb 丸め、その他は 100lb 丸め)

---

## 4. ROUTE / CRUISE 行

```
       FL    SPD  DIST  ROUTE
RJAA-KLAX  S/C   NML   4933NM  TRK3/EASTBOUND PACOTS TRK-3
KLAX-KONT F110  LRC  0134NM S01 /PDZ SB
KLAX-     F000        0000NM /
STEP CLIMB 350/41N50 370/41N40 390/
W/F P092 MXSH 08/PAINT MINTMP M62/TREVR  PROG 2300UK
```

- FL: `S/C` = Step Climb mode、`Fxxx` = 固定 FL
- SPD: `NML` または `LRC` (Long Range Cruise) など
- DIST: 総距離 NM
- STEP CLIMB: 高度変更計画 (FL/WP ペア)
- W/F = Wind Factor (P=Plus追風, M=Minus向風)
- MXSH = Max Wind Shear (kts/1000ft) / そのWP名
- MINTMP = Min Temperature (M=Minus) / そのWP名
- PROG = 風予報のソース (NW=NWS USA, UK=Bracknell UK, AD=Aviation Digital)

---

## 5. WT PLAN (重量)

```
-WT PLAN
PAX 234/CGO 041580/BUFF 003000/PAYLOAD 088000 OEW 409600 IDX +226
PZFW 500600 MZFW 535000 CREW 03/14
PTOW 714987 MTOW 870000 TOLT       FLEX MTOW:A
PLDW 527982 MLDW 584000 LDLT
```

| ラベル | 意味 |
|---|---|
| PAX | 旅客数 (予約ベース) |
| CGO | カーゴ重量 (推定) |
| BUFF | バッファー重量 |
| PAYLOAD | 推定ペイロード |
| OEW | Operating Empty Weight |
| IDX | Index |
| **PZFW** | **Planned Zero Fuel Weight** |
| MZFW | Max Zero Fuel Weight (構造制限) |
| CREW | Cockpit/Cabin (例: 03/14) |
| **PTOW** | **Planned Takeoff Weight** |
| MTOW | Max Takeoff Weight (構造制限) |
| TOLT | Takeoff Limit Weight (制限ある時のみ) |
| FLEX MTOW | A / B / C |
| **PLDW** | **Planned Landing Weight** |
| **MLDW** | **Max Landing Weight (構造制限)** |
| LDLT | Landing Limit Weight (制限ある時のみ) |

### 重量の関係式

- `PTOW ≈ PZFW + FOB - TAX`
- `PLDW ≈ PTOW - BOF`
- 巡航中の任意のWPでの重量: `PZFW + (そのWPでの Plan Remain Fuel)`
- そのWPでの重量が **MLDW を下回ると着陸可能になる** (= MLDW行を挿入する点)
- Actual Fuel が入力されている場合は: `PZFW + Actual Remain Fuel`

---

## 6. NAVIGATION LOG 本体 (パーサーのメイン対象)

```
NAVIGATION LOG
RJAA ELEV  0135FT                              ← 出発空港 + 標高
TC  GS  CTME  LAT/LONG     ETO ZTME ALT  FUEL  TMP    ← ヘッダ
MC  TAS RTME  (WP)POS      ATO DIST FL   RMG   SAT
                           (RDIS)    214.4              ← Take-off Fuel

097 ..  00.04   ..  0480   . 0.08 CLM  206.8  ....  ..   ← 行A
103 ..  08.41   CVC          ... FL    R     ....   ..   ← 行B
- - - - - - - - - - - - - - - - - - - (4769) - - - - - -  ← セパレータ + RDIS
101 ..  00.22   N35180E143300                              ← TOC
107 ..  08.27   TOC         . 135 FL   R    ...   ..
- - - - - - - - - - - - - - - - - - - (4758) - - - ( 9) - -

101 658 00.23  N35144E143487 . 0.01 35000 196.5 -45 280165 41/50  ← 通常WP
107 493 08.27 ...                  115 FL  R   - / 03
... 続く ...

ELEV 0126FT                                                ← 到着空港標高
```

### WP 1点 = 行A + 行B のペア構成

| 列 | 行A | 行B |
|---|---|---|
| 1 | TC (True Course, 度) | MC (Mag Course, 度) |
| 2 | GS (Ground Speed, kts) | TAS (True Air Speed, kts) |
| 3 | CTME (Cumulative Time) | RTME (Remain Time) |
| 4 | **LAT/LONG (緯度経度)** | **(WP)POS (WP名)** |
| 5 | . | (空) |
| 6 | ETO (Estimated Time Over) | ATO (Actual Time Over, 空欄) |
| 7 | ZTME (Zone Time) | DIST (Zone Distance NM) |
| 8 | ALT (Planned Altitude) | FL (実FL記入欄, 空欄) |
| 9 | FUEL (Plan Remain Fuel) | RMG (Actual remain記入欄) |
| 10 | TMP (ISA Deviation, 例 -45) | SAT (記入欄) |
| 11 | ZWIND (例: 280165 = 280°/165kt) | MW/TP (Max Wind Lvl/Tropopause Lvl, x1000ft) |
| 12 | (補足: WSCP Wind Shear Component, kts/1000ft) | |

### 緯度経度の形式
- `N35349E141433` = N 35°34.9' E 141°43.3'
- `[NS]\d{5}[EW]\d{6,7}` (北南: 度2桁+分3桁、東西: 度3桁+分3桁、ただし時々分が4桁になる場合あり)

### 高度欄 (ALT列) の値
- `35000` 等の数字 = 飛行高度 (フィート)
- `CLM` = Climbing
- `DEC` = Descending

### ZWIND の形式 (Zone Wind)
- 6桁: `280165` = 風向 280°、風速 165kt
- 詳細は WIND/TEMP ALOFT FCST セクション参照

### MW/TP の形式
- `41/50` = Max Wind Level 41 (=41,000ft)、Tropopause Level 50 (=50,000ft)
- 値は x1000ft

### 特殊 WP マーカー (WP名欄に出る特殊値)

| マーカー | 意味 | 行A の LAT/LONG |
|---|---|---|
| `TOC` | Top of Climb | あり |
| `TOD` | Top of Descent | あり |
| `FIR` | FIR 境界 | あり |
| `ETP1`〜`ETP4` | Equal Time Point (n=airport pair番号) | あり |
| `EEP1`〜`EEP3` | ETOPS Entry Point (n=airport pair番号) | あり |
| `EXP1`〜`EXP3` | ETOPS Exit Point (n=airport pair番号) | あり |

**重要**: EEP/EXP/ETP が通常の WP と同じ位置にある場合、Navigation Log には WP として表示されず、EEP/EXP/ETP のラベルが優先される(WP名は上書きされない)。

### CRP 表記
WP名の後に `-CRP-` がついている場合: Compulsory Reporting Point。

例: `39E80 -CRP- 231 FL R - / 04`

### セパレータ行と RDIS
- `- - - (xxxx) - - - ` の `(xxxx)` 部分は **RDIS = Remain Distance** (NM)
- 末尾の `- - - ( N) - - -` の `( N)` 部分は **そのレグの番号**

### 行Bの WP 名で誤検出されやすい単語 (skipWords)

パーサーが WP 名として拾ってはいけない単語:

| カテゴリ | 単語 |
|---|---|
| 高度関連 | `FL`, `CLM`, `DEC`, `TOC`, `TOD` |
| 燃料関連 | `R` (RMG欄), `RMG`, `FOB`, `FOD`, `BOF`, `CON`, `RSV`, `ALT`, `TAX`, `REQ`, `PCF`, `EXT`, `MLDW`, `MZFW`, `PZFW`, `PTOW`, `PLDW`, `MTOW`, `TOLT`, `LDLT` |
| ETP関連 | `ETP`, `ETP1`〜`ETP4`, `EEP`, `EEP1`〜`EEP3`, `EXP`, `EXP1`〜`EXP3` |
| その他 | `PLAN`, `NML`, `STD`, `STA`, `P` (Pratt&Whitney等), `ELEV`, `CRP`, `MEA`, `MAA`, `FIR` |

### パース終了条件 (NAVLOG 本体の終わり)

以下のセクションヘッダが出たら WP の読み取りを停止:

- `ALTERNATE DATA 1` / `ALTERNATE DATA 2`
- `ETP SUMMARY` / `EQUAL TIME POINT`
- `DIVERSION SUMMARY`
- `-WINDS/TEMP ALOFT FCST`

### 出発 / 到着空港の取得
- 出発: NAVLOG 本体の **最初の行** `XXXX ELEV xxxxFT` から ICAO を抽出
- 到着: NAVLOG 本体の **最後の行** `ELEV xxxxFT` の前にある ICAO 行から抽出
- またはヘッダの `RJAA-KLAX` 形式から取得 (こちらの方が確実)

---

## 7. ETP DATA (ETOPS Plan 以外でも記載される)

```
-ETP DATA
RJCC/PANC 02/54 1712NM N38378E175066 04/18 1535/1873NM M063/P015
PANC/KSFO 05/52 3375NM N41030W148546 02/42 1209/1248NM P028/P043
RJAA/PHNL 02/32 1497NM N38054E170360 04/14 1454/1913NM M077/P031
PHNL/KSFO 05/34 3201NM N41054W152438 03/03 1213/1421NM M023/P045
```

各行 = 1つの ETP 空港ペア:

| 位置 | 例 | 意味 |
|---|---|---|
| 1 | `RJCC/PANC` | 後方/前方の代替空港ペア |
| 2 | `02/54` | 出発空港から ETP までの ETE (HH/MM) |
| 3 | `1712NM` | 出発空港から ETP までの距離 |
| 4 | `N38378E175066` | ETP の緯度経度 |
| 5 | `04/18` | ETP から ETP空港 までの ETE |
| 6 | `1535/1873NM` | ETP から後方 / 前方 への距離 |
| 7 | `M063/P015` | 後方 / 前方への風成分 (M=向風 P=追風, kts) |

`ETP1` etc が NAVLOG 本体に WP として登場し、対応する空港ペアが番号と一致する。

---

## 8. ALTERNATE DATA セクション

```
ALTERNATE DATA 1
-N0359F110 DCT PDZ DCT PDZO46011 DCT SB DCT
POS    LAT       LONG    MC  DIST  ZTIE  ETO ATO ALT TMP ZWIND
PDZ    N33551    W117318 078 0088  0.18  ...     110 -13 309022
PDZO4  N34005    W117202 048 0011  0.02  ...     110 -13 303019
SB     N34034    W117220 347 0003  0.01  ...     110 -13 303018
KONT   N34034    W117361 257 0032  0.07  ...     110 -13 304018
```

目的地から代替空港までの経路。フォーマットは NAVLOG 本体と異なり 1行/WP の簡易版。
**パーサーはここを WP として取り込まない**(終了マーカーで break)。

---

## 9. ETP SUMMARY (ETOPS Plan のみ)

```
-ETP SUMMARY DATA
CRZ TO   BURN FL MORA TO    BURN FL MORA FOB    LAT     LONG     W
LRC RJTT 095310 100 080 PMDY 094019 100 012 137197 N35402 E161168
LRC PMDY 050883 100 080 PHNL 050756 100 076 059758 N25582 W167192
1LE RJTT 074993 340 080 PMDY 076113 340 012 137197 N35402 E161168
1LE PMDY 040033 360 080 PHNL 040209 360 076 059758 N25582 W167192

WARNING FLAGS: M=MORA, D=FUEL DUMP REQ., F=DIVERT FUEL REQ.
```

各 ETP につき LRC (全エンジン正常) と 1LE (1エンジン故障) のデータが出る。
A380 のみ 2LE データも追加される。

---

## 10. ATS Flight Plan (FILE ADRS セクション)

```
-FILE ADRS
RJJJZQZX KZAKZQZX KZAKZRZX KZCEZQZX KSFOXAAG RJAAZPZX KZOAZQZX
KZOAZRZX RJAAANAN RJTTANAB
(FPL-ANA6-IS
-B77W/H-SDE2FGHIJ5J6M1M2RWXYZ/LB1D1
-RJAA0815
-N0493F350 DCT CVC OTR13 VEPOX/M084F350 DCT 37N160E 38N170E 39N180E
 40N170W 41N160W 41N150W/M084F370 41N140W/M084F390 40N130W DCT
 TREVR/N0481F390 DCT PAINT DCT PIRAT DCT AVE SADDE6
-KLAX0851 KONT
-PBN/A1B1C1D1L1O1S2 NAV/RNVD1E2A1 DOF/010223 REG/JA782A
EET/KZAK0206 ADIZ1545 KZOA0745 KZLA0824
SEL/ABCM CODE/869166
RMK/TAS0485 TCAS EQUIPPED
-E/1022 P/251 R/UVE S/M J/L D/8 472 C SILVER
A/BLUE ANA
C/SORANO.T)
```

ICAO 標準のフライトプラン形式。

### 取れる重要情報

- `-RJAA0815` : 出発空港 + EOBT (UTC HHMM)
- `-KLAX0851 KONT` : 到着空港 + EET、代替空港
- **`EET/KZAK0206 ADIZ1545 KZOA0745 KZLA0824`** :
  - **FIR 境界の通過予定時刻** (出発後の経過時間 HHMM)
  - 例: KZAK FIR への通過時刻 = 出発+02時間06分
  - **これは色分け用の確実な FIR 境界情報のソース** になる
  - 現在の `-XXXX` 検出より信頼性が高い
- `REG/JA782A` : 機番
- `SEL/ABCM` : SELCAL コード
- `E/1022` : Endurance (HHMM)
- `P/251` : Persons on board
- `C/SORANO.T` : 機長名

---

## 11. WIND/TEMP ALOFT FCST

```
-WINDS/TEMP ALOFT FCST
FD DATA BASED ON 2300UKZ FOR ETD 231300Z
            12000  18000  24000  30000  34000  39000  45000
CVC         2655M06 2877M14 2895M27 7843M36 7863M43 7870M53 7850M62
VACKY       2755M06 2874M15 2892M27 7842M36 7862M43 7867M53 7849M62
SEALS       2751M06 2870M15 2889M28 7942M37 7965M44 7869M53 7852M62
```

各 WP の各高度における風と温度。

### 風の形式 (4桁 + M/P + 2桁温度)
- `2768M17` = 風向 270° / 風速 68kt / -17°C
- `6725M34` = 風向 170° / 風速 125kt / -34°C
  - 風向の1桁目が 5 以上のとき: 風向 = (1桁目-5)×100 + 残り×10、風速 = 末尾2桁 +100
- `2900M34` = 風向 290° / 風速 100kt / -34°C
- `9900M34` = light and variable / -34°C (特殊値)

---

## 12. その他のセクション

| セクション | 内容 | パーサー対応 |
|---|---|---|
| `-FLEET INFO` | 機装情報 (ACARS/SATCOM/FANS/TCAS/GPS、CORR.F、MEL/CDL) | 一部抽出 (機材) |
| `-RAIM FOR TERMINAL INFO` | RAIM ホール情報 (日本国内空港のみ) | 不要 |
| `-DISPATCHR COMMENT` | INTENTION/EXTRA/SPEED/ROUTE/ALT/ALTN/OTHER | 表示する価値あり |
| `-CONX PAX INFO` | 接続便情報 | 不要 |
| `-P.I.C NAME` | 機長名 | 表示用 |
| `-SUMMARY PLAN` | 別 FL のサマリー (FL350/FL330/FL310 等) | 不要 |
| `-TANKER DATA` | Tanker 計画時の燃料コスト比較 | 将来対応 |

---

## 13. ana-Calculator パーサー実装メモ

### 現在の `runParse` ロジック

1. ヘッダから機番、機材コード、出発-到着、代替空港を抽出
2. 燃料セクションから depFuel を取得
3. NAVLOG 本体をループして WP を検出 (`coordRe = /([NS]\d{5}[EW]\d{6,7})/`)
4. 行B から WP 名を抽出、skipWords に該当するものは除外
5. ALTERNATE DATA / ETP SUMMARY / EQUAL TIME POINT / DIVERSION SUMMARY が出たら break

### 現在の課題と改善余地

#### MLDW 行の挿入 (未実装)
- `WT PLAN` から MLDW、PZFW、FOB、TAX を取得
- PTOW = PZFW + FOB - TAX
- 各 WP での予想重量 = PZFW + Plan Remain Fuel
- 初めて MLDW を下回る WP の **直前** に MLDW 行を挿入
- Actual Fuel 入力対応: ユーザーが行ごとに RMG を入れたらそれで再計算
- 表示: 大元サイト風オレンジ系 (背景 `rgba(255,152,0,.15)`、文字 `#ff9800`、▼ MLDW 380.0)

#### FIR 境界の検出ソースを変更
- 現在: ハイフン付き WP (`-KZAK` 等) を検出 → 不安定
- 改善案A: ATS FPL の `EET/` セクションから時刻ベースで取得 → CTME と照合
- 改善案B (現状の実装): VATSIM FIR GeoJSON のポリゴン判定 → 既に実装済み

#### ZWIND の活用 (未着手)
- 各WPの 280165 形式から風向風速を取り出して地図上に表示できる
- `wp.zwind = {dir: 280, spd: 165}` として格納

#### Wind/Temp Aloft の活用 (未着手)
- WIND/TEMP ALOFT FCST セクションから各高度の風データを取得
- 高度プロファイルの可視化が可能

---

## 14. パース時の正規表現リファレンス

```javascript
// 緯度経度
var coordRe = /([NS]\d{5}[EW]\d{6,7})/;

// プラン種別
var planTypeRe = /\b(NML|ETOPS\/120|ETOPS\/180|ETOPS\/207|RCLR|NML\/TANKER|RCL\/TANKER)\s+PLAN\b/;

// 出発・到着
var routeRe = /\b([A-Z]{4})-([A-Z]{4})\b/;

// 機番
var regRe = /\b(JA\d{4}[A-Z]?)\b/;

// 機材コード (JetPlan 内部)
var typeRe = /\b(NH8A|NH8C|NH9D|NH9K|NHXK|NH7E|NH7K|NH7L|NH7S|NHTR)\b/;

// ICAO 機種コード (フォールバック)
var icaoTypeRe = /\b(B788|B789|B772|B773|B77W|B77F|B767|B763|B738|B748|A359|A380|DH8D)\b/;

// 重量値
var pzfwRe = /PZFW\s+(\d+)/;
var fobRe = /\bFOB\s+\d{2}\/\d{2}\s+(\d+)/;  // FUEL PLAN 内の FOB
var mldwRe = /MLDW\s+(\d+)/;
var ptowRe = /PTOW\s+(\d+)/;
var taxRe = /TAX\s+(\d{6})/;

// FIR 境界 (ATS FPL 内)
var eetRe = /EET\/([A-Z]{4}\d{4}(?:\s+[A-Z]{4}\d{4})*)/;

// パース終了マーカー
var stopRe = /ALTERNATE\s+DATA|ETP\s+SUMMARY|EQUAL\s+TIME\s+POINT|DIVERSION\s+SUMMARY|WINDS\/TEMP\s+ALOFT/i;
```