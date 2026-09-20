/** Opt-in encrypted browser storage. No passphrase or plaintext is persisted. */
export const VAULT_KEY = "myfinance.encrypted-vault.v1";
const iterations = 600000;
function base64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function bytes(text: string) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}
async function derive(passphrase: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encryptVault(
  plaintext: string,
  passphrase: string,
): Promise<string> {
  if (passphrase.length < 12)
    throw new Error("パスフレーズは12文字以上にしてください");
  if (plaintext.length > 2_000_000)
    throw new Error("保存データは2MB以下にしてください");
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return JSON.stringify({
    v: 1,
    kdf: "PBKDF2-SHA256",
    iterations,
    salt: base64(salt),
    iv: base64(iv),
    data: base64(new Uint8Array(ciphertext)),
  });
}
export async function decryptVault(
  envelope: string,
  passphrase: string,
): Promise<string> {
  if (envelope.length > 8_000_000) throw new Error("保存形式が不正です");
  try {
    const e = JSON.parse(envelope);
    if (
      e.v !== 1 ||
      e.kdf !== "PBKDF2-SHA256" ||
      e.iterations !== iterations ||
      typeof e.salt !== "string" ||
      typeof e.iv !== "string" ||
      typeof e.data !== "string"
    )
      throw new Error("schema");
    const salt = bytes(e.salt),
      iv = bytes(e.iv);
    if (salt.length !== 16 || iv.length !== 12) throw new Error("length");
    const key = await derive(passphrase, salt);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      bytes(e.data),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new Error("パスフレーズが違うか、保存データが破損しています");
  }
}
