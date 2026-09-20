/** Shared, fail-closed single-owner authentication. Use HTTPS in production. */
export async function authorized(
  header: string | null,
  username?: string,
  password?: string,
): Promise<boolean> {
  if (
    !username ||
    !password ||
    password.length < 20 ||
    !header?.startsWith("Basic ")
  )
    return false;
  try {
    const actual = atob(header.slice(6));
    const digest = async (s: string) =>
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
      );
    const [a, b] = await Promise.all([
      digest(actual),
      digest(`${username}:${password}`),
    ]);
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  } catch {
    return false;
  }
}
export function configuredAuth() {
  return Boolean(
    process.env.FINANCE_USER &&
    process.env.FINANCE_PASSWORD &&
    process.env.FINANCE_PASSWORD.length >= 20,
  );
}

// Next normalizes loopback URL hosts; compare the browser Origin with the
// actual Host instead. Do not trust client-supplied X-Forwarded-Host.
export function sameOrigin(origin: string | null, host: string | null, protocol: string) {
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return ["http:", "https:"].includes(protocol) && url.protocol === protocol &&
      url.host === host && url.origin === origin;
  } catch { return false; }
}
