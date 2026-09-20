# データ仕様 v2

日本円のみ。金額は整数円、1項目最大1,000億円。欠損はJSONのnull / CSVの空欄で表す。日時はタイムゾーン付きISO 8601、利用日はYYYY-MM-DD。日付の存在も検証する。

## accounts / FinanceAccounts

`id,name,kind,balance,asOf,estimated`

- kind: `bank` / `broker` / `card`。
- bank.balance: 確認済み銀行残高。broker.balance: **証券預り金（現金のみ）**。card.balance: カード未払額（0以上）。
- asOf: 金融機関の値を確認した日時。アプリを再表示した日時ではない。
- estimated: `true` / `false`。メールから推定した残高などはtrue。
- JSONはsource（`demo/csv/manual/email/api`）が必要。CSVはcsv、GASの手動シートはmanualにする。
- 負の銀行残高はJSONで表現可能。共通CSVは安全のため0以上の整数のみ対応。

## holdings / FinanceHoldings

`id,accountId,name,ticker,wrapper,cost,value,asOf`

- accountId: 対応するbroker口座のid。
- wrapper: `NISA` / `特定` / `一般`。
- cost: **現在保有分の取得原価**。累計買付額ではない。
- value: 口数×単価/基準口数などを適切に計算した保有分の円評価額。株式の1株単位と投信の1万口単位を混同しない。
- 評価額の欠損を0とみなした損益は計算しない。0は本当のゼロ評価として許可。
- 株式分割、移管、売却、再投資は証券会社の保有残高で照合する。

## entries / FinanceEntries

`id,accountId,date,merchant,amount,kind,status,category,replaces`

- id: 同じ取引の再取込で同じID、別取引には別ID。日付・金額・店舗だけで生成しない。
- amount: 絶対額。kindで方向を決める。
- kind: `expense/refund/income/transfer/investment`。
- status: `pending/posted/void`。
- replaces: 確定明細が置き換える同口座・同種別のpending明細ID。1つのpendingへの複数置換や置換チェーンは拒否。
- 確定時に金額が変わっても、確認したIDで置換すれば速報は集計対象から外れる。
- 同じ日・店舗・金額でも別IDなら別取引。曖昧一致で勝手に消さない。
- GASの旧支出ログのsource_idに対してreplaces_idを設定すると、APIでは`mail-`接頭辞を付けて対応する。

## JSON全体

```json
{
  "version": 2,
  "mode": "import",
  "asOf": "2026-09-17T06:00:00Z",
  "accounts": [],
  "holdings": [],
  "entries": [],
  "history": [],
  "warnings": []
}
```

historyは`{date,value}`（純資産の実測保存値）。GASのFinanceHistoryは`date,value`ヘッダー。履歴がない場合に買付原価から利益を仮定して作らない。
同じ日付のhistory、重複ID、デモ混在、不正値、存在しない口座参照は拒否。JSON取込は全体置換。CSVはIDごとの追記・同内容再取込スキップ。CSVの途中で不正行があれば全体を拒否し、既存データは変更しない。

## 計算

- 純資産 = 銀行残高 + 証券預り金 + 保有評価額 − カード未払額。
- 不明残高・不明評価額があれば「取得済み分」。推定残高を含む場合は推定表示。
- 確定支出 = posted expense − posted refund。
- 未確定支出 = pending expense − pending refund。
- 予算残額 = 設定予算 − 確定支出 − 未確定支出。
- 月末予測 = （確定＋未確定）÷経過日数×月の日数。固定費の支払日を補正しない単純モデル。
- transfer、investment、income、void、置換済みpendingは支出除外。
- 将来日付の明細は支出集計対象外。JST基準。銀行残高を明細から勝手に加減しない。
