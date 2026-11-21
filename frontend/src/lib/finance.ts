/** Canonical JPY ledger. Amounts are integer yen; balances never inferred from spend. */
export type Source = "demo" | "csv" | "manual" | "email" | "api";
export type Account = {
  id: string;
  name: string;
  kind: "bank" | "card" | "broker";
  balance: number | null;
  asOf: string | null;
  source: Source;
  estimated: boolean;
};
export type Holding = {
  id: string;
  accountId: string;
  name: string;
  ticker: string;
  wrapper: "NISA" | "特定" | "一般";
  cost: number;
  value: number | null;
  asOf: string | null;
};
export type Entry = {
  id: string;
  accountId: string;
  date: string;
  merchant: string;
  amount: number;
  kind: "expense" | "refund" | "income" | "transfer" | "investment";
  status: "pending" | "posted" | "void";
  category: string;
  source: Source;
  replaces?: string;
};
export type Snapshot = {
  version: 2;
  mode: "demo" | "live" | "import";
  asOf: string;
  accounts: Account[];
  holdings: Holding[];
  entries: Entry[];
  history: { date: string; value: number }[];
  warnings: string[];
};
export type Insight = {
  id: string;
  level: "attention" | "info";
  title: string;
  detail: string;
  evidence: string;
  entryIds: string[];
};

export const kindNames = {
  expense: "支出",
  refund: "返金",
  income: "収入",
  transfer: "振替",
  investment: "投資",
};
export const yen = (n: number) =>
  new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(n);
export const jstDate = (date = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(date);
export const monthOf = (date: string) => date.slice(0, 7);
export function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
function timestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) &&
    validDate(value.slice(0, 10)) &&
    Number.isFinite(Date.parse(value))
  );
}
function amount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    Math.abs(value) <= 100_000_000_000
  );
}
function word(value: unknown): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= 200
  );
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function oneOf(value: unknown, values: string[]) {
  return typeof value === "string" && values.includes(value);
}
function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
const sources = ["demo", "csv", "manual", "email", "api"];

function ledgerRow(label: string, item: unknown, index: number) {
  return record(item) && word(item.id)
    ? `${label}ID ${item.id}`
    : `${label}の${index + 1}件目`;
}

/** Validate every external boundary. Missing values stay null, never silently become zero. */
export function validateSnapshot(input: unknown): Snapshot {
  assert(
    record(input) &&
      input.version === 2 &&
      oneOf(input.mode, ["demo", "live", "import"]) &&
      timestamp(input.asOf),
    "データ形式または取得日時が不正です",
  );
  for (const key of ["accounts", "holdings", "entries", "history", "warnings"])
    assert(
      Array.isArray(input[key]) && input[key].length <= 10000,
      `${key} は最大10,000件の配列が必要です`,
    );
  const s = input as unknown as Snapshot;
  const accountKinds = new Map<string, Account["kind"]>();
  for (const [index, a] of s.accounts.entries()) {
    const label = ledgerRow("口座", a, index);
    assert(
      record(a) && word(a.id) && word(a.name),
      `${label} のIDまたは口座名が不正です`,
    );
    assert(
      oneOf(a.kind, ["bank", "card", "broker"]),
      `${label} の口座種別が不正です`,
    );
    assert(
      a.balance === null || amount(a.balance),
      `${label} の残高が整数円の範囲外です`,
    );
    assert(
      a.asOf === null || timestamp(a.asOf),
      `${label} の確認日時が不正です`,
    );
    assert(
      sources.includes(a.source) && typeof a.estimated === "boolean",
      `${label} の出典または推定フラグが不正です`,
    );
    assert(!accountKinds.has(a.id), `口座IDが重複しています: ${a.id}`);
    accountKinds.set(a.id, a.kind);
    assert(
      a.kind !== "card" || a.balance === null || a.balance >= 0,
      `${label} のカード未払額は0以上で指定してください`,
    );
    assert(
      a.balance === null || a.asOf !== null,
      `${label} の残高には確認日時が必要です`,
    );
    assert(
      s.mode === "demo" || a.source !== "demo",
      `${label} はデモ口座のため実データに混在できません`,
    );
  }
  const holdingIds = new Set<string>();
  for (const [index, h] of s.holdings.entries()) {
    const label = ledgerRow("保有銘柄", h, index);
    assert(
      record(h) && word(h.id) && word(h.name) && word(h.ticker),
      `${label} のID・銘柄名・銘柄コードを確認してください`,
    );
    assert(
      oneOf(h.wrapper, ["NISA", "特定", "一般"]),
      `${label} の口座区分が不正です`,
    );
    assert(
      amount(h.cost) &&
        h.cost >= 0 &&
        (h.value === null || (amount(h.value) && h.value >= 0)),
      `${label} の取得原価または評価額が不正です`,
    );
    assert(
      h.asOf === null || timestamp(h.asOf),
      `${label} の評価日時が不正です`,
    );
    assert(
      accountKinds.has(h.accountId),
      `${label} の参照先口座「${h.accountId ?? ""}」が存在しません`,
    );
    assert(
      accountKinds.get(h.accountId) === "broker",
      `${label} には証券口座を指定してください`,
    );
    assert(
      h.value === null || h.asOf !== null,
      `${label} の評価額には評価日時が必要です`,
    );
    assert(!holdingIds.has(h.id), `${label} が重複しています`);
    holdingIds.add(h.id);
  }
  const entriesById = new Map<string, Entry>();
  for (const [index, e] of s.entries.entries()) {
    const label = ledgerRow("明細", e, index);
    assert(
      record(e) && word(e.id) && word(e.merchant) && word(e.category),
      `${label} のID・店舗名・カテゴリを確認してください`,
    );
    assert(amount(e.amount) && e.amount >= 0, `${label} の金額が不正です`);
    assert(
      oneOf(e.kind, ["expense", "refund", "income", "transfer", "investment"]),
      `${label} の取引種別が不正です`,
    );
    assert(
      oneOf(e.status, ["pending", "posted", "void"]),
      `${label} の取引状態が不正です`,
    );
    assert(
      sources.includes(e.source) &&
        (e.replaces === undefined || word(e.replaces)),
      `${label} の出典または置換先IDが不正です`,
    );
    assert(validDate(e.date), `${label} の日付が不正です（YYYY-MM-DD）`);
    assert(
      accountKinds.has(e.accountId),
      `${label} の参照先口座「${e.accountId ?? ""}」が存在しません`,
    );
    assert(!entriesById.has(e.id), `明細IDが重複しています: ${e.id}`);
    entriesById.set(e.id, e);
    assert(
      s.mode === "demo" || e.source !== "demo",
      `${label} はデモ明細のため実データに混在できません`,
    );
  }
  const replaced = new Set<string>();
  for (const e of s.entries) {
    if (!e.replaces) continue;
    const original = entriesById.get(e.replaces);
    assert(
      original &&
        original.status === "pending" &&
        e.status === "posted" &&
        original.accountId === e.accountId &&
        original.kind === e.kind &&
        !original.replaces &&
        !replaced.has(original.id),
      `明細ID ${e.id} の置換先は同口座・同種別の未確定明細を1件指定してください`,
    );
    replaced.add(original.id);
  }
  const historyDates = new Set<string>();
  for (const h of s.history) {
    assert(
      record(h) &&
        validDate(h.date) &&
        amount(h.value) &&
        !historyDates.has(h.date),
      "資産履歴の形式または日付が不正です",
    );
    historyDates.add(h.date);
  }
  assert(
    s.warnings.every((w) => typeof w === "string" && w.length <= 1000),
    "警告の形式が不正です",
  );
  return s;
}

export function emptySnapshot(now = new Date().toISOString()): Snapshot {
  return {
    version: 2,
    mode: "import",
    asOf: now,
    accounts: [],
    holdings: [],
    entries: [],
    history: [],
    warnings: [],
  };
}
export function activeEntries(entries: Entry[]) {
  const replaced = new Set(
    entries
      .filter((e) => e.status === "posted" && e.replaces)
      .map((e) => e.replaces),
  );
  return entries.filter((e) => e.status !== "void" && !replaced.has(e.id));
}
export function summarize(
  s: Snapshot,
  month: string,
  budget: number,
  today = jstDate(),
) {
  const active = activeEntries(s.entries).filter(
    (e) => monthOf(e.date) === month && e.date <= today,
  );
  const signed = (e: Entry) =>
    e.kind === "expense" ? e.amount : e.kind === "refund" ? -e.amount : 0;
  const spent = active
    .filter((e) => e.status === "posted")
    .reduce((n, e) => n + signed(e), 0);
  const pending = active
    .filter((e) => e.status === "pending")
    .reduce((n, e) => n + signed(e), 0);
  const days = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5)),
    0,
  ).getDate();
  const elapsed =
    month < monthOf(today)
      ? days
      : month === monthOf(today)
        ? Number(today.slice(8))
        : 0;
  const projected = elapsed
    ? Math.round(((spent + pending) / elapsed) * days)
    : 0;
  const cash = s.accounts
    .filter((a) => a.kind !== "card")
    .reduce((n, a) => n + (a.balance ?? 0), 0);
  const debt = s.accounts
    .filter((a) => a.kind === "card")
    .reduce((n, a) => n + (a.balance ?? 0), 0);
  const investment = s.holdings.reduce((n, h) => n + (h.value ?? 0), 0);
  const known = s.holdings.filter((h) => h.value !== null);
  const cost = s.holdings.reduce((n, h) => n + h.cost, 0);
  const profit = known.reduce((n, h) => n + h.value! - h.cost, 0);
  const partial =
    !s.accounts.length ||
    s.accounts.some((a) => a.balance === null) ||
    s.holdings.some((h) => h.value === null);
  const categories = Object.entries(
    active.reduce<Record<string, number>>((acc, e) => {
      const n = signed(e);
      if (n) acc[e.category] = (acc[e.category] ?? 0) + n;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  return {
    spent,
    pending,
    projected,
    cash,
    debt,
    investment,
    cost,
    profit,
    partial,
    net: cash + investment - debt,
    remaining: budget - spent - pending,
    days,
    elapsed,
    categories,
  };
}
export function analyze(
  s: Snapshot,
  month: string,
  budget: number,
  today = jstDate(),
): Insight[] {
  const t = summarize(s, month, budget, today),
    insights: Insight[] = [];
  const entries = activeEntries(s.entries).filter(
    (e) => monthOf(e.date) === month && e.date <= today && e.kind === "expense",
  );
  if (t.projected > budget && t.elapsed > 0)
    insights.push({
      id: "budget",
      level: "attention",
      title: `月末に${yen(t.projected - budget)}の予算超過ペース`,
      detail: `確定・未確定を含む${yen(t.spent + t.pending)}を、経過${t.elapsed}日から月${t.days}日へ単純換算。固定費の支払日で変動します。`,
      evidence: `${yen(t.spent + t.pending)} ÷ ${t.elapsed} × ${t.days} − ${yen(budget)}`,
      entryIds: activeEntries(s.entries)
        .filter(
          (e) =>
            monthOf(e.date) === month &&
            e.date <= today &&
            (e.kind === "expense" || e.kind === "refund"),
        )
        .map((e) => e.id),
    });
  if (t.pending)
    insights.push({
      id: "pending",
      level: "info",
      title: `未確定の利用 ${yen(t.pending)}`,
      detail:
        "取消や金額変更の可能性があります。確定明細との対応IDがない場合は自動で同一視しません。",
      evidence: "未確定の支出 − 未確定の返金",
      entryIds: entries.filter((e) => e.status === "pending").map((e) => e.id),
    });
  const values = entries
    .filter((e) => e.status === "posted")
    .map((e) => e.amount)
    .sort((a, b) => a - b);
  const median = values.length ? values[Math.floor(values.length / 2)] : 0;
  for (const e of entries
    .filter((e) => values.length >= 5 && e.amount > Math.max(10000, median * 4))
    .slice(0, 3))
    insights.push({
      id: `large-${e.id}`,
      level: "attention",
      title: `${e.merchant}の${yen(e.amount)}を確認`,
      detail:
        "高額利用の候補です。予定していた購入かを確認してください。不正利用の判定ではありません。",
      evidence: `明細中央値${yen(median)}の4倍かつ10,000円超`,
      entryIds: [e.id],
    });
  const max = [...s.holdings]
    .filter((h) => h.value !== null)
    .sort((a, b) => b.value! - a.value!)[0];
  if (max && t.investment && max.value! / t.investment > 0.4)
    insights.push({
      id: "concentration",
      level: "info",
      title: `${max.name}が評価額の${Math.round((max.value! / t.investment) * 100)}%`,
      detail:
        "取得済みの保有評価額に対する割合です。ファンド内部の組入銘柄の重複は含みません。",
      evidence: `${yen(max.value!)} ÷ ${yen(t.investment)}`,
      entryIds: [],
    });
  if (t.partial)
    insights.push({
      id: "partial",
      level: "attention",
      title: "資産総額は一部のデータのみ",
      detail:
        "残高・未払額・評価額が未取得の項目があります。画面の合計は取得済みの範囲です。",
      evidence: "未取得の値を0円として確定表示しない",
      entryIds: [],
    });
  return insights;
}

/** RFC4180-style CSV lexer including escaped quotes and CRLF. */
export function parseCsv(text: string): string[][] {
  assert(
    text.length <= 2_000_000 &&
      new TextEncoder().encode(text).length <= 2_000_000,
    "CSVは2MB以下にしてください",
  );
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const input = text.replace(/^\uFEFF/, "");
  const location = () =>
    rows.length ? `CSVのデータ${rows.length}件目` : "CSVのヘッダー";
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === "," || c === "\n" || c === "\r") {
      row.push(cell);
      cell = "";
      closed = false;
      if (c !== ",") {
        if (row.some((x) => x !== "")) rows.push(row);
        row = [];
        if (c === "\r" && input[i + 1] === "\n") i++;
      }
    } else if (c === '"' && !cell && !closed) quoted = true;
    else {
      if (closed || c === '"')
        throw new Error(`${location()}の引用符が不正です`);
      cell += c;
    }
  }
  if (quoted) throw new Error(`${location()}の引用符が閉じられていません`);
  row.push(cell);
  if (row.some((x) => x !== "")) rows.push(row);
  assert(
    rows.length >= 2 && rows.length <= 10001,
    "CSVはヘッダーと1〜10,000行が必要です",
  );
  assert(
    new Set(rows[0]).size === rows[0].length,
    "CSVのヘッダーが重複しています",
  );
  const wrongWidth = rows.findIndex((r) => r.length !== rows[0].length);
  assert(
    wrongWidth === -1,
    `CSVのデータ${wrongWidth}件目の列数がヘッダーと一致しません`,
  );
  return rows;
}

type CsvItem = Account | Holding | Entry;
export type CsvPreview = {
  kind: "accounts" | "holdings" | "entries";
  snapshot: Snapshot;
  added: number;
  skipped: number;
  rows: { item: CsvItem; skipped: boolean }[];
};

export function previewCsv(
  text: string,
  current: Snapshot,
  now = new Date().toISOString(),
): CsvPreview {
  const [rawHeaders, ...rows] = parseCsv(text);
  const headers = rawHeaders.map((h) => h.trim());
  assert(
    new Set(headers).size === headers.length,
    "CSVのヘッダーが重複しています",
  );
  const s = structuredClone(
    current.mode === "demo" ? emptySnapshot(now) : current,
  );
  s.mode = "import";
  s.asOf = now;
  const number = (v: string) => {
    assert(/^\d+$/.test(v), "金額はカンマなしの0以上の整数で指定してください");
    return Number(v);
  };
  const nullable = (v: string) => (v === "" ? null : number(v));
  const samples: CsvPreview["rows"] = [];
  let skipped = 0;
  let kind: CsvPreview["kind"];
  function merge<T extends CsvItem>(
    target: T[],
    toItem: (fields: Record<string, string>) => T,
  ) {
    const byId = new Map(target.map((item) => [item.id, item]));
    for (const [index, row] of rows.entries()) {
      const fields = Object.fromEntries(
        headers.map((h, i) => [h, row[i].trim()]),
      );
      try {
        const item = toItem(fields);
        assert(word(item.id), "IDは空欄にせず、200文字以内で指定してください");
        const existing = byId.get(item.id);
        if (existing) {
          // CSV records are flat. A JSON round-trip may reorder their fields.
          const keys = Object.keys({ ...existing, ...item }) as (keyof T)[];
          assert(
            keys.every((key) => existing[key] === item[key]),
            `ID ${item.id} の内容が同じIDの行と異なります`,
          );
          skipped++;
        } else {
          target.push(item);
          byId.set(item.id, item);
        }
        if (samples.length < 5)
          samples.push({ item, skipped: Boolean(existing) });
      } catch (error) {
        throw new Error(
          `CSVのデータ${index + 1}件目：${error instanceof Error ? error.message : "形式が不正です"}`,
        );
      }
    }
  }
  if (headers.includes("merchant")) {
    kind = "entries";
    merge(s.entries, (r) => ({
      id: r.id,
      accountId: r.accountId,
      date: r.date,
      merchant: r.merchant,
      amount: number(r.amount),
      kind: r.kind as Entry["kind"],
      status: r.status as Entry["status"],
      category: r.category,
      source: "csv",
      ...(r.replaces ? { replaces: r.replaces } : {}),
    }));
  } else if (headers.includes("ticker")) {
    kind = "holdings";
    merge(s.holdings, (r) => ({
      id: r.id,
      accountId: r.accountId,
      name: r.name,
      ticker: r.ticker,
      wrapper: r.wrapper as Holding["wrapper"],
      cost: number(r.cost),
      value: nullable(r.value),
      asOf: r.asOf || null,
    }));
  } else if (headers.includes("balance")) {
    kind = "accounts";
    merge(s.accounts, (r) => {
      assert(
        r.estimated === "true" || r.estimated === "false",
        "estimatedはtrueまたはfalseで指定してください",
      );
      return {
        id: r.id,
        name: r.name,
        kind: r.kind as Account["kind"],
        balance: nullable(r.balance),
        asOf: r.asOf || null,
        source: "csv",
        estimated: r.estimated === "true",
      };
    });
  } else
    throw new Error(
      "対応するCSVヘッダーがありません。テンプレートを使用してください",
    );
  return {
    kind,
    snapshot: validateSnapshot(s),
    added: rows.length - skipped,
    skipped,
    rows: samples,
  };
}

export function importCsv(
  text: string,
  current: Snapshot,
  now?: string,
): Snapshot {
  return previewCsv(text, current, now).snapshot;
}

export function freshness(asOf: string | null, now = new Date().toISOString()) {
  if (!asOf) return "未取得";
  const hours = (Date.parse(now) - Date.parse(asOf)) / 3600000;
  if (hours < -1) return "日時を確認";
  return hours > 24 ? "24時間超・要確認" : "24時間以内";
}
