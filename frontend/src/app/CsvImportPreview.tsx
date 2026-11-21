import { kindNames, type CsvPreview } from "@/lib/finance";

const kindLabels = {
  accounts: "口座",
  holdings: "保有資産",
  entries: "取引明細",
};
const accountKinds = { bank: "銀行", card: "カード", broker: "証券" };
const entryStatuses = { pending: "未確定", posted: "確定", void: "取消" };

export default function CsvImportPreview({
  preview,
  filename,
  money,
}: {
  preview: CsvPreview;
  filename: string;
  money: (value: number) => string;
}) {
  const total = preview.added + preview.skipped;
  return (
    <section className="csv-preview" aria-labelledby="csv-preview-title">
      <h3 id="csv-preview-title">{kindLabels[preview.kind]}の取込プレビュー</h3>
      <p role="status">
        新規{preview.added}件・同内容{preview.skipped}件
      </p>
      <table>
        <caption>
          {filename} · {total}件中、先頭{preview.rows.length}件
        </caption>
        <thead>
          <tr>
            <th scope="col">判定</th>
            <th scope="col">内容 / ID</th>
            <th scope="col" className="align-right">
              金額
            </th>
          </tr>
        </thead>
        <tbody>
          {preview.rows.map(({ item, skipped }, index) => {
            let name, details, amount;
            if ("merchant" in item) {
              name = item.merchant;
              details = `${item.date} · ${kindNames[item.kind]}（${entryStatuses[item.status]}） · ${item.category} · 口座 ${item.accountId}`;
              amount = money(item.amount);
            } else if ("ticker" in item) {
              name = item.name;
              details = `${item.ticker} · ${item.wrapper} · 口座 ${item.accountId}`;
              amount = (
                <>
                  評価 {item.value === null ? "未取得" : money(item.value)}
                  <small>取得 {money(item.cost)}</small>
                </>
              );
            } else {
              name = item.name;
              details = accountKinds[item.kind] + (item.estimated ? " · 推定" : "");
              amount = item.balance === null ? "未取得" : money(item.balance);
            }
            return (
              <tr key={index}>
                <td>{skipped ? "同内容" : "新規"}</td>
                <td>
                  <strong>{name}</strong>
                  <small>
                    {item.id} · {details}
                  </small>
                </td>
                <td className="align-right amount">{amount}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
