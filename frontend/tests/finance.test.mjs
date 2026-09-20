import test from "node:test";
import assert from "node:assert/strict";
import {
  activeEntries,
  analyze,
  emptySnapshot,
  freshness,
  importCsv,
  jstDate,
  parseCsv,
  summarize,
  validateSnapshot,
} from "../src/lib/finance.ts";
import { demoSnapshot } from "../src/lib/demo.ts";
import { authorized } from "../src/lib/access.ts";
const now = "2026-09-17T06:00:00Z";
const base = () => ({
  ...emptySnapshot(now),
  accounts: [
    {
      id: "bank",
      name: "銀行",
      kind: "bank",
      balance: 100000,
      asOf: now,
      source: "manual",
      estimated: false,
    },
    {
      id: "card",
      name: "カード",
      kind: "card",
      balance: 10000,
      asOf: now,
      source: "manual",
      estimated: false,
    },
    {
      id: "broker",
      name: "証券預り金",
      kind: "broker",
      balance: 20000,
      asOf: now,
      source: "manual",
      estimated: false,
    },
  ],
  holdings: [
    {
      id: "h",
      accountId: "broker",
      name: "株式",
      ticker: "TEST",
      wrapper: "NISA",
      cost: 25000,
      value: 30000,
      asOf: now,
    },
  ],
});
const entry = (id, changes = {}) => ({
  id,
  accountId: "card",
  date: "2026-09-01",
  merchant: "店舗",
  amount: 1000,
  kind: "expense",
  status: "posted",
  category: "食費",
  source: "manual",
  ...changes,
});
test("demo is a valid fictional snapshot", () =>
  assert.equal(validateSnapshot(demoSnapshot(new Date(now))).mode, "demo"));
test("bank + brokerage CASH + positions - liabilities; no double counted brokerage total", () =>
  assert.equal(summarize(base(), "2026-09", 10000, "2026-09-17").net, 140000));
test("refunds lower expenses, transfer, income, investment and void do not count", () => {
  const s = base();
  s.entries = [
    entry("a", { amount: 3000 }),
    entry("b", { kind: "refund", amount: 500 }),
    entry("c", { kind: "transfer", amount: 3000 }),
    entry("d", { kind: "investment", amount: 2000 }),
    entry("e", { kind: "income", amount: 4000 }),
    entry("f", { status: "void", amount: 1000 }),
  ];
  assert.equal(summarize(s, "2026-09", 5000, "2026-09-17").spent, 2500);
});
test("pending becomes posted through explicit matching, even with changed amount", () => {
  const s = base();
  s.entries = [
    entry("p", { status: "pending", amount: 1000 }),
    entry("settled", { replaces: "p", amount: 1200 }),
  ];
  validateSnapshot(s);
  const totals = summarize(s, "2026-09", 10000, "2026-09-17");
  assert.equal(totals.spent, 1200);
  assert.equal(totals.pending, 0);
  assert.equal(activeEntries(s.entries).length, 1);
});
test("identical genuine purchases with different IDs both count", () => {
  const s = base();
  s.entries = [entry("a"), entry("b")];
  assert.equal(summarize(s, "2026-09", 10000, "2026-09-17").spent, 2000);
});
test("cannot reconcile two posted rows to one pending row or across accounts", () => {
  const s = base();
  s.entries = [
    entry("p", { status: "pending" }),
    entry("a", { replaces: "p" }),
    entry("b", { replaces: "p" }),
  ];
  assert.throws(() => validateSnapshot(s));
  s.entries = [
    entry("p", { status: "pending" }),
    entry("a", { accountId: "bank", replaces: "p" }),
  ];
  assert.throws(() => validateSnapshot(s));
});
test("unknown position is not treated as a total loss and unknown debt marks partial", () => {
  const s = base();
  s.holdings[0].value = null;
  s.accounts[1].balance = null;
  const t = summarize(s, "2026-09", 1000);
  assert.equal(t.profit, 0);
  assert.equal(t.partial, true);
});
test("zero valuation is valid and represents a genuine full loss", () => {
  const s = base();
  s.holdings[0].value = 0;
  validateSnapshot(s);
  assert.equal(summarize(s, "2026-09", 1000).profit, -25000);
});
test("current month extrapolates including pending; historical month uses full days", () => {
  const s = base();
  s.entries = [
    entry("a", { amount: 1000 }),
    entry("b", { status: "pending", amount: 500 }),
  ];
  assert.equal(summarize(s, "2026-09", 10000, "2026-09-15").projected, 3000);
  assert.equal(summarize(s, "2026-09", 10000, "2026-10-02").projected, 1500);
});
test("future entries excluded, JST date is used and leap-year month handled", () => {
  assert.equal(jstDate(new Date("2026-09-30T16:00:00Z")), "2026-10-01");
  const s = base();
  s.entries = [entry("a", { date: "2026-09-30" })];
  assert.equal(summarize(s, "2026-09", 1000, "2026-09-17").spent, 0);
  assert.equal(summarize(s, "2024-02", 1000, "2024-02-15").days, 29);
});
test("CSV handles BOM, quoted commas, newlines and escaped quotes", () => {
  assert.deepEqual(parseCsv('\uFEFFa,b\r\n"hello, world","a""b\nc"\r\n'), [
    ["a", "b"],
    ["hello, world", 'a"b\nc'],
  ]);
  assert.throws(() => parseCsv('a,b\n"unfinished,x'));
  assert.throws(() => parseCsv('a,b\n"x"oops,y'));
  assert.throws(() => parseCsv("a,a\nx,y"));
  assert.throws(() => parseCsv("a,b\nx"));
});
const accountCsv = `id,name,kind,balance,asOf,estimated\nbank,銀行,bank,100000,${now},false\ncard,カード,card,,${now},false`;
const expenseCsv =
  'id,accountId,date,merchant,amount,kind,status,category,replaces\na,card,2026-09-01,"A, B",1000,expense,posted,食費,';
test("first CSV import clears demo; imports are idempotent by stable ID", () => {
  let s = importCsv(accountCsv, demoSnapshot(new Date(now)), now);
  assert.equal(s.mode, "import");
  assert.equal(s.holdings.length, 0);
  assert.equal(s.accounts.length, 2);
  s = importCsv(expenseCsv, s, now);
  s = importCsv(expenseCsv, s, now);
  assert.equal(s.entries.length, 1);
  assert.equal(s.entries[0].merchant, "A, B");
  assert.equal(s.accounts[1].balance, null);
});
test("CSV conflict and invalid row rejects whole import without mutating original", () => {
  const s = importCsv(
    expenseCsv,
    importCsv(accountCsv, emptySnapshot(now), now),
    now,
  );
  const before = JSON.stringify(s);
  assert.throws(() => importCsv(expenseCsv.replace("1000", "2000"), s, now));
  assert.equal(JSON.stringify(s), before);
  assert.throws(() =>
    importCsv(expenseCsv.replace("2026-09-01", "2026-02-30"), s, now),
  );
  assert.equal(JSON.stringify(s), before);
  assert.throws(() => importCsv(expenseCsv.replace("1000", "NaN"), s, now));
});
test("holdings CSV links to brokerage; missing price does not fabricate gain", () => {
  const s = importCsv(
    `id,accountId,name,ticker,wrapper,cost,value,asOf\nnew,broker,銘柄,TEST2,特定,5000,,`,
    base(),
    now,
  );
  assert.equal(s.holdings[1].value, null);
  assert.equal(summarize(s, "2026-09", 1000).partial, true);
});
test("missing fields, NaN, unknown accounts, impossible dates, duplicate IDs and demo mixing rejected", () => {
  for (const change of [
    (s) => (s.accounts[0].balance = NaN),
    (s) => (s.accounts[0].asOf = null),
    (s) => (s.holdings[0].accountId = "missing"),
    (s) => (s.accounts[0].source = "demo"),
    (s) => s.accounts.push({ ...s.accounts[0] }),
    (s) => s.entries.push(entry("bad", { date: "2026-02-30" })),
    (s) => s.entries.push(entry("bad", { amount: 1.5 })),
  ]) {
    const s = base();
    change(s);
    assert.throws(() => validateSnapshot(s));
  }
});
test("insights expose evidence and only eligible expense IDs", () => {
  const s = base();
  s.entries = [
    entry("a", { amount: 30000 }),
    entry("income", { kind: "income" }),
  ];
  const items = analyze(s, "2026-09", 1000, "2026-09-17");
  const warning = items.find((i) => i.id === "budget");
  assert.ok(warning.evidence.includes("17"));
  assert.deepEqual(warning.entryIds, ["a"]);
});
test("stale and future timestamps remain explicit", () => {
  assert.equal(freshness(null, now), "未取得");
  assert.equal(freshness("2026-09-15T06:00:00Z", now), "24時間超・要確認");
  assert.equal(freshness("2026-09-18T06:00:00Z", now), "日時を確認");
});
test("private endpoints fail closed for absent, weak, invalid and mismatched credentials", async () => {
  const pass = "test-password-at-least-20-characters";
  const header = "Basic " + btoa("owner:" + pass);
  assert.equal(await authorized(header, "owner", pass), true);
  assert.equal(await authorized(null, "owner", pass), false);
  assert.equal(await authorized(header, "owner", "short"), false);
  assert.equal(await authorized(header, "other", pass), false);
  assert.equal(await authorized("Basic ???", "owner", pass), false);
  assert.equal(await authorized(header, undefined, undefined), false);
});
test("CSV rejects ambiguous boolean values instead of claiming verified balance", () => {
  assert.throws(() =>
    importCsv(accountCsv.replaceAll("false", "no"), emptySnapshot(now), now),
  );
});
