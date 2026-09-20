import test from "node:test";
import assert from "node:assert/strict";
import { encryptVault, decryptVault } from "../src/lib/vault.ts";
test("encrypted vault round-trip, random salts, no plaintext, wrong password and tamper rejection", async () => {
  const plaintext = JSON.stringify({ balance: 123456, merchant: "秘密の店舗" }),
    pass = "a-local-test-passphrase";
  const a = await encryptVault(plaintext, pass),
    b = await encryptVault(plaintext, pass);
  assert.notEqual(a, b);
  assert.equal(a.includes("123456"), false);
  assert.equal(a.includes(pass), false);
  assert.equal(await decryptVault(a, pass), plaintext);
  await assert.rejects(() => decryptVault(a, "incorrect-password"));
  const modified = JSON.parse(a);
  modified.data = modified.data.slice(0, -8) + "AAAAAAAA";
  await assert.rejects(() => decryptVault(JSON.stringify(modified), pass));
  await assert.rejects(() => encryptVault(plaintext, "short"));
});
