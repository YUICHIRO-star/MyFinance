import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const main = fs.readFileSync(
  new URL("../../backend/gas/Main.js", import.meta.url),
  "utf8",
);
const snapshot = fs.readFileSync(
  new URL("../../backend/gas/FinanceSnapshot.js", import.meta.url),
  "utf8",
);
const writer = fs.readFileSync(
  new URL("../../backend/gas/SpreadsheetWriter.js", import.meta.url),
  "utf8",
);
function context(extra = {}) {
  return vm.createContext({
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text) => ({
        text,
        setMimeType() {
          return this;
        },
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => "a".repeat(32) }),
    },
    ...extra,
  });
}
test("GAS no longer exposes data via GET or permits balance mutation", () => {
  let called = 0;
  const c = context({
    getFinanceSnapshotV2: () => {
      called++;
      return { version: 2 };
    },
  });
  vm.runInContext(main, c);
  for (const payload of [
    { action: "snapshot_v2" },
    { action: "snapshot_v2", token: "wrong" },
    { action: "adjust_balance", token: "a".repeat(32), amount: 123 },
  ])
    assert.equal(
      JSON.parse(
        c.doPost({ postData: { contents: JSON.stringify(payload) } }).text,
      ).status,
      "error",
    );
  assert.equal(JSON.parse(c.doGet().text).status, "error");
  assert.equal(called, 0);
  assert.equal(
    JSON.parse(
      c.doPost({
        postData: {
          contents: JSON.stringify({
            action: "snapshot_v2",
            token: "a".repeat(32),
          }),
        },
      }).text,
    ).status,
    "ok",
  );
  assert.equal(called, 1);
});
test("missing GAS Script Property disables reads even for empty client token", () => {
  const c = context({
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => null }),
    },
  });
  vm.runInContext(main, c);
  assert.equal(
    JSON.parse(
      c.doPost({
        postData: { contents: '{"action":"snapshot_v2","token":""}' },
      }).text,
    ).status,
    "error",
  );
});
function sheet(values) {
  return {
    getLastRow: () => values.length,
    getDataRange: () => ({ getValues: () => values.map((r) => [...r]) }),
    getRange: (r, c, rows, cols) => ({
      getValues: () =>
        values
          .slice(r - 1, r - 1 + rows)
          .map((v) => v.slice(c - 1, c - 1 + cols)),
      setValues: () => {},
    }),
    appendRow: (r) => values.push(r),
  };
}
test("GAS snapshot uses explicit account snapshots, preserves unknown card liability, and stable mail matching", () => {
  const sheets = {
    FinanceAccounts: sheet([
      ["id", "name", "kind", "balance", "asOf", "estimated"],
      ["b", "銀行", "bank", 12345, "2026-09-17T00:00:00Z", false],
    ]),
    expenses: sheet([
      [
        "date",
        "amount",
        "merchant",
        "card",
        "method",
        "express",
        "recorded",
        "source_id",
        "replaces_id",
      ],
      ["2026/09/10", 1000, "店舗", "rakuten", "", "速報", "", "source-a", ""],
      [
        "2026/09/10",
        1200,
        "店舗",
        "rakuten",
        "",
        "",
        "",
        "source-b",
        "source-a",
      ],
    ]),
  };
  const c = context({
    CONFIG: {
      spreadsheet: { id: "test", sheetName: "legacy" },
      expense: { sheetName: "expenses" },
    },
    SpreadsheetApp: { openById: () => ({ getSheetByName: (n) => sheets[n] }) },
  });
  vm.runInContext(snapshot, c);
  const s = c.getFinanceSnapshotV2();
  assert.equal(s.mode, "live");
  assert.equal(s.accounts[0].balance, 12345);
  assert.equal(s.accounts[1].balance, null);
  assert.equal(s.entries[1].replaces, "mail-source-a");
  assert.equal(s.holdings.length, 0);
});
test("card writer keeps distinct identical purchases and rejects replay by message ID", () => {
  const values = [
    [
      "date",
      "amount",
      "merchant",
      "card",
      "method",
      "express",
      "recorded",
      "source_id",
      "replaces_id",
    ],
  ];
  const target = sheet(values);
  const c = context({ formatDate: () => "2026/09/17", logInfo: () => {} });
  vm.runInContext(writer, c);
  c.getOrCreateExpenseSheet = () => target;
  const e = {
    date: new Date(),
    amount: 1000,
    merchant: "店舗",
    cardName: "rakuten",
    paymentMethod: "一回",
    isExpress: false,
    sourceId: "a",
  };
  assert.equal(c.writeExpenseRecord(e), true);
  assert.equal(c.writeExpenseRecord(e), false);
  assert.equal(c.writeExpenseRecord({ ...e, sourceId: "b" }), true);
  assert.equal(values.length, 3);
});
