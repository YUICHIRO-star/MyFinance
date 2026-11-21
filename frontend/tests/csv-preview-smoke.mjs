import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const fixture = (name) =>
  fileURLToPath(new URL(`./fixtures/csv-preview/${name}.csv`, import.meta.url));
const button = (scope, name) =>
  scope.getByRole("button", { name, exact: true });
const upload = (name, text) => ({
  name,
  mimeType: "text/csv",
  buffer: Buffer.from(text),
});

async function openImport(page) {
  await button(page, "データ連携").click();
  await button(page, "ファイルを取り込む").click();
  return page.getByRole("dialog");
}

async function expectPreview(dialog, kind, counts) {
  const region = dialog.getByRole("region", {
    name: kind + "の取込プレビュー",
  });
  await region.getByText(counts, { exact: true }).waitFor();
  return region;
}

async function exportedLedger(page) {
  const downloading = page.waitForEvent("download");
  await button(page.getByRole("dialog"), "JSONを保存").click();
  return JSON.parse(await readFile(await (await downloading).path(), "utf8"));
}

export async function checkCsvPreview(page, savedVault) {
  await page.clock.setFixedTime(new Date("2026-11-21T03:00:00Z"));
  await button(page, "入出金").click();
  await page.getByLabel("集計月").fill("2026-11");
  await page.getByLabel("月間予算（円）").fill("75000");
  await button(page, "金額を隠す").click();
  const dialog = await openImport(page);
  const input = dialog.getByLabel("取込ファイル");
  const confirm = button(dialog, "取り込む");
  const cancel = button(dialog, "取り消す");
  const vault = () =>
    page.evaluate(() => localStorage.getItem("myfinance.encrypted-vault.v1"));
  const demo = await exportedLedger(page);
  assert.equal(demo.mode, "demo");
  const accounts = fixture("01-accounts");
  const monthly = fixture("03-month");
  const text = await readFile(monthly, "utf8");

  await input.setInputFiles(accounts);
  await expectPreview(dialog, "口座", "新規1件・同内容0件");
  await cancel.click();
  assert.deepEqual(await exportedLedger(page), demo);
  assert.equal(await vault(), savedVault);
  await input.setInputFiles(accounts);
  await confirm.click();
  await input.setInputFiles(fixture("02-existing"));
  await confirm.click();
  const before = await exportedLedger(page);
  assert.equal(before.mode, "import");
  assert.deepEqual(
    before.entries.map((e) => e.id),
    ["c001"],
  );

  await input.setInputFiles(monthly);
  const preview = await expectPreview(dialog, "取引明細", "新規2件・同内容1件");
  assert.equal(await preview.locator("tbody tr").count(), 3);
  assert.equal(await preview.getByText("••••••", { exact: true }).count(), 3);
  assert.doesNotMatch(await preview.innerText(), /1,?200|600/);
  await cancel.click();
  assert.deepEqual(await exportedLedger(page), before);

  const badRows = [
    [text.replace("1200", "1300"), /c001.*異なります/],
    [text.replace("2026-11-02", "2026-02-30"), /c002.*日付/],
    [text.replace("c002,card", "c002,missing"), /c002.*missing.*存在しません/],
    [text.trimEnd() + ",extra", /データ3件目.*列数/],
  ];
  for (const [bad, reason] of badRows) {
    await input.setInputFiles(monthly);
    await expectPreview(dialog, "取引明細", "新規2件・同内容1件");
    await input.setInputFiles(upload("invalid.csv", bad));
    await dialog.getByRole("alert").filter({ hasText: reason }).waitFor();
    assert.equal(await confirm.count(), 0);
    assert.equal(await dialog.getByRole("region").count(), 0);
    assert.deepEqual(await exportedLedger(page), before);
  }
  assert.equal(await vault(), savedVault);

  // A slow first read must not overwrite the next selection or reopen a closed dialog.
  for (const close of [false, true]) {
    await page.evaluate(() => {
      const original = File.prototype.text;
      const gate = new Promise((resolve) =>
        window.addEventListener("resume-file-read", resolve, { once: true }),
      );
      File.prototype.text = async function () {
        File.prototype.text = original;
        const text = await original.call(this);
        await gate;
        window.dispatchEvent(new Event("resumed-file-read"));
        return text;
      };
    });
    await input.setInputFiles(upload("slow.csv", text));
    if (close) {
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      await button(page, "ファイルを取り込む").click();
    } else {
      await input.setInputFiles(fixture("02-existing"));
      await expectPreview(dialog, "取引明細", "新規0件・同内容1件");
    }
    await page.evaluate(async () => {
      const resumed = new Promise((resolve) =>
        window.addEventListener("resumed-file-read", resolve, { once: true }),
      );
      window.dispatchEvent(new Event("resume-file-read"));
      await resumed;
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    });
    if (close) assert.equal(await confirm.count(), 0);
    else {
      await expectPreview(dialog, "取引明細", "新規0件・同内容1件");
      await cancel.click();
    }
  }

  await input.setInputFiles(monthly);
  await expectPreview(dialog, "取引明細", "新規2件・同内容1件");
  await confirm.evaluate((element) => {
    element.click();
    element.click();
  });
  const committed = await exportedLedger(page);
  assert.deepEqual(
    committed.entries.map((e) => e.id),
    ["c001", "c002", "c003"],
  );
  await page.clock.setFixedTime(new Date("2026-11-21T04:00:00Z"));
  await input.setInputFiles(monthly);
  await expectPreview(dialog, "取引明細", "新規0件・同内容3件");
  await confirm.click();
  assert.deepEqual(await exportedLedger(page), committed);
  await button(dialog, "画面に戻る").click();
  await button(page, "金額を表示").click();
  await button(page, "入出金").click();
  assert.match(
    await page.locator(".expense-summary > div").first().innerText(),
    /2,400/,
  );
  assert.equal(await page.getByLabel("月間予算（円）").inputValue(), "75000");

  await button(page, "金額を隠す").click();
  await openImport(page);
  await input.setInputFiles(
    upload(
      "broker.csv",
      "id,name,kind,balance,asOf,estimated\nbroker,架空証券,broker,,,false",
    ),
  );
  await confirm.click();
  const header = "id,accountId,name,ticker,wrapper,cost,value,asOf";
  const rows = Array.from(
    { length: 6 },
    (_, i) =>
      `h${i},broker,"架空,銘柄${i}",TEST,NISA,5000,6000,2026-11-01T00:00:00Z`,
  );
  await input.setInputFiles(
    upload("holdings.csv", "\uFEFF" + [header, ...rows, rows[0]].join("\r\n")),
  );
  const holdings = await expectPreview(
    dialog,
    "保有資産",
    "新規6件・同内容1件",
  );
  assert.equal(await holdings.locator("tbody tr").count(), 5);
  assert.match(await holdings.innerText(), /架空,銘柄0/);
  assert.doesNotMatch(await holdings.innerText(), /架空,銘柄5/);
  assert.match(await holdings.innerText(), /••••••/);
  assert.doesNotMatch(await holdings.innerText(), /5,?000|6,?000/);
  await confirm.click();
  assert.equal((await exportedLedger(page)).holdings.length, 6);
  await input.setInputFiles(monthly);
  await expectPreview(dialog, "取引明細", "新規0件・同内容3件");
  await input.setInputFiles({
    name: "fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(before)),
  });
  await dialog
    .getByRole("status")
    .filter({ hasText: "fixture.json を取り込みました" })
    .waitFor();
  assert.equal(await confirm.count(), 0);
  assert.deepEqual(await exportedLedger(page), before);
  assert.equal(await vault(), savedVault);
}

export async function checkRefreshDuringPreview(browser, origin, credentials) {
  const page = await browser.newPage({ httpCredentials: credentials });
  const fixtureLedger = {
    version: 2,
    mode: "live",
    asOf: "2026-11-21T03:00:00Z",
    accounts: [
      {
        id: "updated",
        name: "更新された架空口座",
        kind: "bank",
        balance: null,
        asOf: null,
        source: "api",
        estimated: false,
      },
    ],
    holdings: [],
    entries: [],
    history: [],
    warnings: [],
  };
  let resume;
  const responseGate = new Promise((resolve) => {
    resume = resolve;
  });
  await page.route("**/api/finance", async (route) => {
    await responseGate;
    await route.fulfill({ json: fixtureLedger });
  });
  try {
    const started = page.waitForRequest(
      (request) => request.url() === origin + "/api/finance",
    );
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await started;
    const dialog = await openImport(page);
    await dialog
      .getByLabel("取込ファイル")
      .setInputFiles(fixture("01-accounts"));
    await expectPreview(dialog, "口座", "新規1件・同内容0件");
    resume();
    await button(dialog, "取り込む").waitFor({ state: "hidden" });
    await dialog.getByText(/ファイルをもう一度選択してください/).waitFor();
    assert.deepEqual(await exportedLedger(page), fixtureLedger);
  } finally {
    resume();
    await page.close();
  }
}
