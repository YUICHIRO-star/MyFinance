import { NextRequest, NextResponse } from "next/server";
import { authorized, sameOrigin } from "@/lib/access";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function POST(request: NextRequest) {
  if (
    !(await authorized(
      request.headers.get("authorization"),
      process.env.FINANCE_USER,
      process.env.FINANCE_PASSWORD,
    ))
  )
    return json(
      { error: "ローカルAIを使うにはアプリの認証設定が必要です" },
      401,
    );
  if (
    !sameOrigin(request.headers.get("origin"), request.headers.get("host"), request.nextUrl.protocol) ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return json({ error: "同一オリジンのJSONリクエストが必要です" }, 403);
  if (!process.env.OLLAMA_MODEL)
    return json(
      {
        error:
          "ローカルAIは未設定です。Ollamaモデルの設定後に利用できます。上のルール分析は利用可能です",
      },
      503,
    );
  try {
    const raw = await request.text();
    if (raw.length > 4096) return json({ error: "入力が大きすぎます" }, 413);
    const body = JSON.parse(raw),
      s = body.summary;
    if (
      body.consent !== true ||
      !s ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(s.month) ||
      typeof s.partial !== "boolean"
    )
      return json({ error: "同意と集計データが必要です" }, 400);
    const numeric = [
      "budget",
      "spent",
      "pending",
      "projected",
      "cash",
      "debt",
      "investment",
    ];
    if (
      !numeric.every(
        (k) => Number.isSafeInteger(s[k]) && Math.abs(s[k]) <= 1e14,
      )
    )
      return json({ error: "集計値が不正です" }, 400);
    // Allowlisted aggregate fields only. Raw input cannot inject merchants or instructions.
    const summary = {
      month: s.month,
      partial: s.partial,
      ...Object.fromEntries(numeric.map((k) => [k, s[k]])),
    };
    const response = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL,
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "あなたは家計集計を日本語で説明するアシスタントです。渡された数値だけを使用し、事実・仮定を区別して300字以内で説明。budget=予算、spent=確定純支出、pending=未確定純支出、projected=単純換算月末予測、cash=現金、debt=カード未払額、investment=投資評価額。partialがtrueならデータ不足を明記。予測を確定と表現せず、個別銘柄・売買推奨・未提供の税制・残高・収入を作らない。",
          },
          { role: "user", content: JSON.stringify(summary) },
        ],
        options: { temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) throw new Error("upstream");
    const result = await response.json();
    if (typeof result.message?.content !== "string") throw new Error("schema");
    return json({
      text: result.message.content.slice(0, 4000),
      source: "local-ollama",
      generatedAt: new Date().toISOString(),
    });
  } catch {
    return json(
      {
        error:
          "ローカルAIに接続できないか、入力が不正です。Ollamaとモデルを確認してください",
      },
      502,
    );
  }
}
