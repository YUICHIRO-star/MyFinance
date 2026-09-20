import type { Snapshot } from "./finance";
/** Entirely fictional demo; no personal financial records. */
export function demoSnapshot(now = new Date()): Snapshot {
  const asOf = now.toISOString();
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
  }).format(now);
  const month = today.slice(0, 7),
    day = Number(today.slice(8));
  const date = (d: number) =>
    `${month}-${String(Math.min(d, day)).padStart(2, "0")}`;
  return {
    version: 2,
    mode: "demo",
    asOf,
    accounts: [
      {
        id: "bank-a",
        name: "三井住友銀行",
        kind: "bank",
        balance: 842500,
        asOf,
        source: "demo",
        estimated: false,
      },
      {
        id: "bank-b",
        name: "楽天銀行",
        kind: "bank",
        balance: 320000,
        asOf,
        source: "demo",
        estimated: false,
      },
      {
        id: "broker",
        name: "楽天証券",
        kind: "broker",
        balance: 85000,
        asOf,
        source: "demo",
        estimated: false,
      },
      {
        id: "card-a",
        name: "三井住友カード",
        kind: "card",
        balance: 68240,
        asOf,
        source: "demo",
        estimated: false,
      },
      {
        id: "card-b",
        name: "Amazon Mastercard",
        kind: "card",
        balance: 24800,
        asOf,
        source: "demo",
        estimated: false,
      },
    ],
    holdings: [
      {
        id: "global",
        accountId: "broker",
        name: "全世界株式インデックス",
        ticker: "DEMO-GLOBAL",
        wrapper: "NISA",
        cost: 960000,
        value: 1185600,
        asOf,
      },
      {
        id: "us",
        accountId: "broker",
        name: "米国株式インデックス",
        ticker: "DEMO-US",
        wrapper: "NISA",
        cost: 600000,
        value: 738000,
        asOf,
      },
      {
        id: "semi",
        accountId: "broker",
        name: "半導体サンプル株",
        ticker: "DEMO-SEMI",
        wrapper: "特定",
        cost: 100000,
        value: 123400,
        asOf,
      },
    ],
    entries: [
      ["01", 1, "家賃", 44000, "住居", "posted", "expense", "bank-a"],
      ["02", 2, "スーパー", 4200, "食費", "posted", "expense", "card-a"],
      ["03", 3, "Amazon", 12800, "買い物", "posted", "expense", "card-b"],
      ["04", 5, "カフェ", 980, "食費", "posted", "expense", "card-a"],
      ["05", 6, "通信料金", 2200, "通信", "posted", "expense", "card-a"],
      ["06", 8, "電気料金", 4600, "光熱費", "posted", "expense", "bank-a"],
      ["07", 10, "スーパー", 3860, "食費", "posted", "expense", "card-a"],
      ["08", 12, "鉄道", 2480, "交通", "posted", "expense", "card-a"],
      ["09", 13, "レストラン", 5600, "食費", "posted", "expense", "card-a"],
      ["10", 14, "Amazon", 12000, "買い物", "pending", "expense", "card-b"],
      ["11", 15, "カード引落", 40000, "振替", "posted", "transfer", "bank-a"],
      ["12", 16, "給与", 180000, "収入", "posted", "income", "bank-a"],
      ["13", 17, "コンビニ", 860, "食費", "pending", "expense", "card-a"],
    ].map(([id, d, merchant, amount, category, status, kind, accountId]) => ({
      id: `demo-${id}`,
      date: date(d as number),
      merchant: merchant as string,
      amount: amount as number,
      category: category as string,
      status: status as "posted" | "pending",
      kind: kind as "expense" | "transfer" | "income",
      accountId: accountId as string,
      source: "demo",
    })),
    history: Array.from({ length: 12 }, (_, i) => {
      const d = new Date(`${today}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - (11 - i) * 7);
      return {
        date: d.toISOString().slice(0, 10),
        value: [
          2510000, 2580000, 2540000, 2700000, 2730000, 2690000, 2860000,
          2940000, 2880000, 3030000, 3130000, 3201460,
        ][i],
      };
    }),
    warnings: [],
  };
}
