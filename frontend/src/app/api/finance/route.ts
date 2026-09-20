import { NextRequest, NextResponse } from "next/server";
import { authorized } from "@/lib/access";
import { validateSnapshot } from "@/lib/finance";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET(request: NextRequest) {
  if (
    !(await authorized(
      request.headers.get("authorization"),
      process.env.FINANCE_USER,
      process.env.FINANCE_PASSWORD,
    ))
  )
    return json({ error: "認証が必要です" }, 401);
  if (!process.env.GAS_WEB_APP_URL || !process.env.GAS_API_TOKEN)
    return json({ error: "GAS接続URLまたはAPIトークンが未設定です" }, 503);
  try {
    const url = new URL(process.env.GAS_WEB_APP_URL);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "script.google.com" ||
      !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)
    )
      return json({ error: "GASのHTTPSデプロイURLを設定してください" }, 503);
    // Secret in POST body, never in browser bundles, URLs, or logs.
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "snapshot_v2",
        token: process.env.GAS_API_TOKEN,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      return json(
        { error: "連携先に接続できません。最後の取得データを保持します" },
        502,
      );
    const payload = await response.json();
    if (payload.status !== "ok")
      return json({ error: "連携先の認証またはデータ取得に失敗しました" }, 502);
    const snapshot = validateSnapshot(payload.data);
    if (snapshot.mode !== "live")
      return json(
        { error: "実データAPIから不正なデータ種別を受信しました" },
        502,
      );
    return json(snapshot);
  } catch {
    return json(
      {
        error:
          "接続タイムアウトまたはデータ形式エラーです。架空データへの切り替えは行いません",
      },
      502,
    );
  }
}
export async function POST() {
  return json(
    {
      error:
        "残高の書換APIは無効です。確認済みデータを取込または連携先で更新してください",
    },
    405,
  );
}
