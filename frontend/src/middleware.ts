import { NextRequest, NextResponse } from "next/server";
import { authorized, configuredAuth } from "./lib/access";
export async function middleware(request: NextRequest) {
  const protectedMode = Boolean(
    process.env.GAS_WEB_APP_URL ||
    process.env.OLLAMA_MODEL ||
    process.env.FINANCE_USER ||
    process.env.FINANCE_PASSWORD,
  );
  if (!protectedMode) return NextResponse.next();
  if (!configuredAuth())
    return new NextResponse(
      "接続データを保護するため、FINANCE_USER と20文字以上の FINANCE_PASSWORD を設定してください。",
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  if (
    !(await authorized(
      request.headers.get("authorization"),
      process.env.FINANCE_USER,
      process.env.FINANCE_PASSWORD,
    ))
  )
    return new NextResponse("認証が必要です", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="MyFinance", charset="UTF-8"',
        "Cache-Control": "no-store",
      },
    });
  return NextResponse.next();
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
