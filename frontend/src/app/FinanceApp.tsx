"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  activeEntries,
  analyze,
  emptySnapshot,
  freshness,
  importCsv,
  jstDate,
  monthOf,
  summarize,
  validateSnapshot,
  yen,
} from "@/lib/finance";
import type { Snapshot } from "@/lib/finance";
import { decryptVault, encryptVault, VAULT_KEY } from "@/lib/vault";

type Tab = "overview" | "expenses" | "investments" | "insights" | "connections";
const nav: [Tab, string, string][] = [
  ["overview", "ホーム", "grid"],
  ["expenses", "入出金", "arrows"],
  ["investments", "資産・投資", "chart"],
  ["insights", "分析", "spark"],
  ["connections", "データ連携", "link"],
];
const sourceNames = {
  demo: "デモ",
  csv: "CSV",
  manual: "手動",
  email: "メール由来",
  api: "API",
};
const kindNames = {
  expense: "支出",
  refund: "返金",
  income: "収入",
  transfer: "振替",
  investment: "投資",
};
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    arrows: (
      <>
        <path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4" />
      </>
    ),
    chart: (
      <>
        <path d="M4 3v17h17M8 14l4-4 4 2 5-7" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6Z" />
      </>
    ),
    link: (
      <>
        <path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 10a8 8 0 0 0-14-5L3 8m0-5v5h5m-4 6a8 8 0 0 0 14 5l3-3m0 5v-5h-5" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    chevron: <path d="m9 5 7 7-7 7" />,
    wallet: (
      <>
        <rect x="3" y="5" width="18" height="15" rx="3" />
        <path d="M3 8h18m-5 5h5m-4 0v3" />
      </>
    ),
    card: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="3" />
        <path d="M2 10h20M6 15h4" />
      </>
    ),
    shield: (
      <>
        <path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 6 6" />
      </>
    ),
    close: <path d="m5 5 14 14M19 5 5 19" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.wallet}
    </svg>
  );
}
function download(name: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function timeLabel(value: string | null) {
  return value
    ? new Date(value).toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "未取得";
}
function Trend({
  data,
  hidden,
}: {
  data: Snapshot["history"];
  hidden: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const points = [...data].sort((a, b) => a.date.localeCompare(b.date));
  if (hidden)
    return <div className="empty chart-empty">金額を非表示にしています</div>;
  if (points.length < 2)
    return (
      <div className="empty chart-empty">
        資産履歴が2件以上そろうと表示します。
        <br />
        投資元本から評価額を推定することはありません。
      </div>
    );
  const values = points.map((p) => p.value),
    min = Math.min(...values),
    max = Math.max(...values),
    range = Math.max(1, max - min);
  const xy = points.map((p, i) => [
    58 + (i / (points.length - 1)) * 650,
    172 - ((p.value - min) / range) * 133,
  ]);
  const path = xy.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  return (
    <div className="trend">
      <svg
        viewBox="0 0 750 235"
        role="img"
        aria-label="取得した資産履歴の折れ線グラフ"
      >
        <defs>
          <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
            <stop stopColor="#167267" stopOpacity=".16" />
            <stop offset="1" stopColor="#167267" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1="58"
              x2="708"
              y1={39 + i * 44.3}
              y2={39 + i * 44.3}
              stroke="#e5eae7"
              strokeDasharray="3 5"
            />
            <text x="0" y={43 + i * 44.3} fill="#7c8781" fontSize="11">
              {Math.round((max - (range * i) / 3) / 10000)}万
            </text>
          </g>
        ))}
        <path d={`${path} L708,195 L58,195 Z`} fill="url(#area)" />
        <path
          d={path}
          stroke="#157568"
          strokeWidth="3"
          strokeLinejoin="round"
          fill="none"
        />
        {xy.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={hover === i ? 5 : 3} fill="#157568" />
            <rect
              x={x - 20}
              y="20"
              width="40"
              height="180"
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <title>
                {`${points[i].date}: ${yen(points[i].value)}`}
              </title>
            </rect>
          </g>
        ))}
        {[0, Math.floor((points.length - 1) / 2), points.length - 1].map(
          (i) => (
            <text
              key={i}
              x={xy[i][0]}
              y="223"
              textAnchor="middle"
              fill="#7c8781"
              fontSize="11"
            >
              {points[i].date.slice(5).replace("-", "/")}
            </text>
          ),
        )}
      </svg>
      <p className="chart-caption">
        {hover !== null
          ? `${points[hover].date}：${yen(points[hover].value)}`
          : `${points[0].date} — ${points[points.length - 1].date} · 各時点の純資産`}
      </p>
    </div>
  );
}

export default function FinanceApp({
  demo,
  configured,
}: {
  demo: Snapshot;
  configured: boolean;
}) {
  const [data, setData] = useState<Snapshot>(
    configured ? { ...emptySnapshot(), mode: "live" } : demo,
  );
  const [tab, setTab] = useState<Tab>("overview"),
    [month, setMonth] = useState(monthOf(jstDate()));
  const [budget, setBudget] = useState(120000),
    [hidden, setHidden] = useState(false),
    [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"),
    [importOpen, setImportOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [ai, setAi] = useState(""),
    [aiBusy, setAiBusy] = useState(false);
  const [vaultOpen, setVaultOpen] = useState<"save" | "unlock" | null>(null),
    [passphrase, setPassphrase] = useState(""),
    [vaultBusy, setVaultBusy] = useState(false),
    [vaultError, setVaultError] = useState(""),
    [vaultExists, setVaultExists] = useState(false);
  const [inspected, setInspected] = useState<string[] | null>(null),
    [aiConsent, setAiConsent] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const generation = useRef(0),
    request = useRef<AbortController | null>(null);
  const replaceData = (next: Snapshot) => {
    generation.current++;
    request.current?.abort();
    setBusy(false);
    setData(next);
    setAi("");
  };
  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );
  useEffect(() => {
    try {
      setVaultExists(Boolean(localStorage.getItem(VAULT_KEY)));
    } catch {
      /* Storage may be unavailable in private contexts. */
    }
  }, []);
  useEffect(() => {
    if (!importOpen && !vaultOpen) return;
    const previous = document.activeElement as HTMLElement;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setImportOpen(false);
        setVaultOpen(null);
        setPassphrase("");
      }
      if (event.key !== "Tab") return;
      const items = dialog.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select, [tabindex="0"]',
      );
      if (!items?.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [importOpen, vaultOpen]);
  const today = jstDate();
  const total = summarize(data, month, budget, today),
    insights = analyze(data, month, budget, today);
  const money = (n: number) => (hidden ? "••••••" : yen(n));
  const entries = useMemo(
    () =>
      activeEntries(data.entries)
        .filter(
          (e) =>
            monthOf(e.date) === month &&
            (filter === "all" || e.status === filter || e.kind === filter) &&
            `${e.merchant} ${e.category} ${data.accounts.find((a) => a.id === e.accountId)?.name}`
              .toLowerCase()
              .includes(query.toLowerCase()) &&
            (!inspected || inspected.includes(e.id)),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data, month, filter, query, inspected],
  );
  const refresh = useCallback(async () => {
    if (!configured) {
      setNotice(
        "金融機関は未接続です。データ連携からCSVまたはJSONを取り込めます。",
      );
      return;
    }
    if (request.current) return;
    const epoch = generation.current,
      controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/finance", {
        cache: "no-store",
        signal: controller.signal,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "取得できませんでした");
      const next = validateSnapshot(body);
      if (epoch !== generation.current) return;
      setData(next);
      setAi("");
      setNotice(
        "連携先の記録を再取得しました。金融機関自体の即時更新を保証するものではありません。",
      );
    } catch (e) {
      if (!controller.signal.aborted && epoch === generation.current)
        setError(
          e instanceof Error
            ? e.message
            : "接続エラー。最後に取得したデータを保持しています。",
        );
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }, [configured]);
  useEffect(() => {
    if (configured) void refresh();
  }, [configured, refresh]);
  useEffect(() => {
    if (data.mode !== "live" || !configured) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60000);
    return () => clearInterval(timer);
  }, [configured, data.mode, refresh]);
  async function onImport(file?: File) {
    if (!file) return;
    setError("");
    setNotice("");
    try {
      if (file.size > 2_000_000)
        throw new Error("ファイルは2MB以下にしてください");
      const text = await file.text();
      let next: Snapshot;
      if (file.name.toLowerCase().endsWith(".json")) {
        next = validateSnapshot(JSON.parse(text));
        if (next.mode !== "demo") next = { ...next, mode: "import" };
      } else next = importCsv(text, data);
      replaceData(next);
      setInspected(null);
      setNotice(
        `${file.name} を取り込みました。保存前はこのタブ内のみです。データ連携から暗号化保存できます。`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "取込に失敗しました");
    } finally {
      if (input.current) input.current.value = "";
    }
  }
  async function vaultAction() {
    setVaultBusy(true);
    setVaultError("");
    try {
      if (vaultOpen === "save") {
        const encrypted = await encryptVault(
          JSON.stringify({ snapshot: data, budget }),
          passphrase,
        );
        localStorage.setItem(VAULT_KEY, encrypted);
        setVaultExists(true);
        setNotice(
          "現在のデータと予算を暗号化して端末に保存しました。変更後は再度保存してください。",
        );
      } else {
        const stored = localStorage.getItem(VAULT_KEY);
        if (!stored) throw new Error("この端末には保存データがありません");
        const decoded = JSON.parse(await decryptVault(stored, passphrase));
        const snapshot = validateSnapshot(decoded.snapshot);
        if (
          !Number.isSafeInteger(decoded.budget) ||
          decoded.budget < 1 ||
          decoded.budget > 100000000
        )
          throw new Error("保存した予算が不正です");
        replaceData(
          snapshot.mode === "live" ? { ...snapshot, mode: "import" } : snapshot,
        );
        setBudget(decoded.budget);
        setAi("");
        setInspected(null);
        setNotice("端末内のデータを復号しました。自動同期は停止しています。");
      }
      setPassphrase("");
      setVaultOpen(null);
    } catch (e) {
      setVaultError(
        e instanceof Error
          ? e.message
          : "端末保存に失敗しました。ストレージ容量とHTTPS接続を確認してください",
      );
    } finally {
      setVaultBusy(false);
    }
  }
  function template(kind: "accounts" | "holdings" | "entries") {
    const ts = new Date().toISOString();
    const templates = {
      accounts: `id,name,kind,balance,asOf,estimated\nbank,銀行口座,bank,100000,${ts},false\nbroker,証券口座,broker,0,${ts},false\ncard,クレジットカード,card,,${ts},false\n`,
      holdings: `id,accountId,name,ticker,wrapper,cost,value,asOf\nholding-1,broker,サンプル銘柄,SAMPLE,特定,10000,11000,${ts}\n`,
      entries: `id,accountId,date,merchant,amount,kind,status,category,replaces\nentry-1,card,${today},サンプル店舗,1000,expense,posted,食費,\n`,
    };
    download(
      `myfinance-${kind}-template.csv`,
      "\uFEFF" + templates[kind],
      "text/csv;charset=utf-8",
    );
  }
  async function askAI() {
    setAiBusy(true);
    setAi("");
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consent: aiConsent,
          summary: {
            month,
            budget,
            spent: total.spent,
            pending: total.pending,
            projected: total.projected,
            cash: total.cash,
            debt: total.debt,
            investment: total.investment,
            partial: total.partial,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "AIを呼び出せませんでした");
      setAi(body.text);
    } catch (e) {
      setAi(e instanceof Error ? e.message : "AI接続エラー");
    } finally {
      setAiBusy(false);
    }
  }
  function showEvidence(ids: string[]) {
    setInspected(ids);
    setQuery("");
    setFilter("all");
    setTab("expenses");
  }
  function transactions(limit?: number) {
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>利用日 / 内容</th>
              <th>カテゴリ</th>
              <th>口座</th>
              <th>状態</th>
              <th className="align-right">金額</th>
            </tr>
          </thead>
          <tbody>
            {entries.slice(0, limit).map((e) => (
              <tr key={e.id}>
                <td>
                  <div className="merchant">
                    <span
                      className={`merchant-icon ${e.kind === "transfer" ? "muted-icon" : ""}`}
                    >
                      <Icon
                        name={e.kind === "transfer" ? "arrows" : "card"}
                        size={17}
                      />
                    </span>
                    <span>
                      <strong>{e.merchant}</strong>
                      <small>
                        {e.date.replaceAll("-", "/")} · {kindNames[e.kind]}
                      </small>
                    </span>
                  </div>
                </td>
                <td>{e.category}</td>
                <td>
                  <span className="table-account">
                    {data.accounts.find((a) => a.id === e.accountId)?.name}
                  </span>
                </td>
                <td>
                  <span
                    className={`tag ${e.status === "pending" ? "amber" : ""}`}
                  >
                    {e.status === "pending" ? "◷ 未確定" : "✓ 確定"}
                  </span>
                </td>
                <td className="align-right amount">
                  {e.kind === "refund" || e.kind === "income"
                    ? "+"
                    : e.kind === "transfer" || e.kind === "investment"
                      ? ""
                      : "−"}
                  {money(e.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!entries.length && (
          <div className="empty">該当する明細はありません</div>
        )}
      </div>
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => setTab("overview")}
          aria-label="MyFinance ホーム"
        >
          <span className="brand-mark">
            m<span>f</span>
          </span>
          <span>
            MyFinance<small>YOUR MONEY, IN FOCUS</small>
          </span>
        </button>
        <div className="workspace-label">PERSONAL WORKSPACE</div>
        <nav aria-label="メインナビゲーション">
          {nav.map(([id, label, icon]) => (
            <button
              key={id}
              className={tab === id ? "nav-item active" : "nav-item"}
              onClick={() => {
                setTab(id);
                setInspected(null);
              }}
              aria-current={tab === id ? "page" : undefined}
            >
              <Icon name={icon} />
              <span>{label}</span>
              {id === "insights" && (
                <span className="nav-count">{insights.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <Icon name="shield" />
            <strong>あなたのデータを、あなたに。</strong>
            <p>
              取込データはこのタブ内で処理。
              <br />
              端末への暗号化保存も選べます。
            </p>
          </div>
          <div className="profile">
            <span className="avatar">M</span>
            <span>
              パーソナル口座
              <small>
                {data.mode === "demo"
                  ? "デモワークスペース"
                  : data.mode === "live"
                    ? "連携データ"
                    : "ローカル取込"}
              </small>
            </span>
            <span className="version">v2</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            ワークスペース <span>/</span>{" "}
            <strong>{nav.find((n) => n[0] === tab)?.[1]}</strong>
          </div>
          <div className="top-actions">
            <span className="local-label">
              <span />
              プライバシー優先
            </span>
            <button
              className="icon-button"
              onClick={() => setHidden(!hidden)}
              aria-label={hidden ? "金額を表示" : "金額を隠す"}
              aria-pressed={hidden}
            >
              <Icon name="eye" />
            </button>
            <span className="avatar small-avatar">M</span>
          </div>
        </header>
        <main>
          <div className={`mode-banner ${data.mode === "demo" ? "" : "real"}`}>
            <span>
              <strong>
                {data.mode === "demo"
                  ? "DEMO"
                  : data.mode === "live"
                    ? "接続データ"
                    : "取込データ"}
              </strong>
              {data.mode === "demo"
                ? "表示中の金額・口座・履歴は、すべて架空のサンプルです。"
                : data.mode === "live"
                  ? "連携先の記録を表示しています。各口座の確認日時を参照してください。"
                  : "金融機関との自動同期はありません。変更後は暗号化保存してください。"}
            </span>
            <button onClick={() => setImportOpen(true)}>
              データを取り込む <Icon name="chevron" size={14} />
            </button>
          </div>
          {vaultExists && data.mode === "demo" && (
            <div className="message">
              この端末に暗号化された保存データがあります。
              <button
                onClick={() => {
                  setVaultError("");
                  setVaultOpen("unlock");
                }}
              >
                開く
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {tab === "overview"
                  ? "YOUR FINANCIAL PICTURE"
                  : "MYFINANCE / " + tab.toUpperCase()}
              </p>
              <h1>
                {
                  {
                    overview: "お金の流れを、ひとつに。",
                    expenses: "日々の支出を、見通す。",
                    investments: "資産の現在地を、知る。",
                    insights: "数字の理由を、読み解く。",
                    connections: "データの出どころを、確かに。",
                  }[tab]
                }
              </h1>
              <p className="subtitle">
                {tab === "overview"
                  ? "資産も、支出も、次の判断も。あなたのお金を見渡す場所。"
                  : "取得済みのデータと、まだ分からないことを区別して表示します。"}
              </p>
            </div>
            <div className="heading-actions">
              <label className="month-control">
                <span className="sr-only">集計月</span>
                <input
                  aria-label="集計月"
                  type="month"
                  value={month}
                  onChange={(e) => {
                    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value))
                      setMonth(e.target.value);
                  }}
                />
              </label>
              <button
                className="button primary"
                onClick={() => void refresh()}
                disabled={busy || data.mode === "import"}
              >
                <Icon name="refresh" size={16} />
                {busy ? "取得中…" : "再取得"}
              </button>
            </div>
          </div>
          {error && (
            <div className="message error" role="alert">
              要確認：{error}{" "}
              {data.mode === "live" &&
                "取得済みデータがある場合は保持しています。"}
            </div>
          )}
          {notice && (
            <div className="message" role="status">
              {notice}
              <button aria-label="通知を閉じる" onClick={() => setNotice("")}>
                <Icon name="close" size={14} />
              </button>
            </div>
          )}
          {data.warnings.map((w, i) => (
            <div className="message warning" key={i}>
              要確認：{w}
            </div>
          ))}
          {(tab === "overview" || tab === "investments") && (
            <section className="metrics" aria-label="資産サマリー">
              <article className="metric hero-metric">
                <div className="metric-label">
                  純資産
                  {total.partial
                    ? "（取得済み分）"
                    : data.accounts.some((a) => a.estimated)
                      ? "（推定含む）"
                      : ""}
                  <Icon name="wallet" size={18} />
                </div>
                <div className="metric-value">{money(total.net)}</div>
                <div className="metric-note">
                  現預金 ＋ 投資評価額 − カード未払額
                </div>
                <div className="hero-shape" />
              </article>
              <article className="metric">
                <div className="metric-label">
                  現預金・証券預り金
                  <Icon name="wallet" size={18} />
                </div>
                <div className="metric-value">{money(total.cash)}</div>
                <div className="metric-note">銀行残高 ＋ 証券口座の現金</div>
              </article>
              <article className="metric">
                <div className="metric-label">
                  投資評価額
                  <Icon name="chart" size={18} />
                </div>
                <div className="metric-value">{money(total.investment)}</div>
                <div className="metric-note">
                  <span
                    className={
                      total.profit >= 0 ? "positive" : "attention-text"
                    }
                  >
                    {total.profit >= 0 ? "+" : ""}
                    {money(total.profit)}
                  </span>{" "}
                  評価取得済み銘柄の損益
                </div>
              </article>
              <article className="metric">
                <div className="metric-label">
                  カード未払額
                  <Icon name="card" size={18} />
                </div>
                <div className="metric-value">{money(total.debt)}</div>
                <div className="metric-note">現在確認できている未払残高</div>
              </article>
            </section>
          )}
          {tab === "overview" && (
            <>
              <div className="overview-grid">
                <section className="panel trend-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>資産の推移</h2>
                      <p>
                        {data.mode === "demo"
                          ? "架空の履歴サンプル"
                          : "保存された純資産スナップショット"}
                      </p>
                    </div>
                    <span className="subtle-tag">全期間</span>
                  </div>
                  <Trend data={data.history} hidden={hidden} />
                </section>
                <section className="panel budget-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>今月の支出</h2>
                      <p>{month.replace("-", "年")}月 · 未確定を含む</p>
                    </div>
                    <Icon name="arrows" />
                  </div>
                  <div className="spend-number">
                    {money(total.spent + total.pending)}
                    <span>/ {money(budget)}</span>
                  </div>
                  <div className="progress-track">
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(0, ((total.spent + total.pending) / budget) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="budget-detail">
                    <span>予算の残り</span>
                    <strong
                      className={total.remaining < 0 ? "attention-text" : ""}
                    >
                      {money(total.remaining)}
                    </strong>
                  </div>
                  <div className="budget-detail">
                    <span>
                      月末予測 <small>単純換算</small>
                    </span>
                    <strong>{money(total.projected)}</strong>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setTab("expenses")}
                  >
                    支出と予算を見る <Icon name="chevron" size={15} />
                  </button>
                </section>
              </div>
              <section className="insight-strip">
                <div className="insight-symbol">
                  <Icon name="spark" size={23} />
                </div>
                <div>
                  <span className="eyebrow">
                    FINANCIAL INSIGHT · ルール分析
                  </span>
                  <h3>
                    {hidden
                      ? "金額を表示すると分析を確認できます"
                      : insights[0]?.title || "取得済みのデータを整理しました"}
                  </h3>
                  <p>
                    {hidden
                      ? "分析の金額を非表示にしています。"
                      : insights[0]?.detail ||
                        "予算や残高を取り込むと、数字に基づく気づきを表示します。"}
                  </p>
                </div>
                <button className="button" onClick={() => setTab("insights")}>
                  根拠を見る <Icon name="chevron" size={15} />
                </button>
              </section>
              <div className="overview-grid lower-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>最近の入出金</h2>
                      <p>振替・投資は生活費の集計から除外</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setTab("expenses")}
                    >
                      すべて見る <Icon name="chevron" size={14} />
                    </button>
                  </div>
                  {transactions(5)}
                </section>
                <section className="panel accounts-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>口座一覧</h2>
                      <p>残高・未払額の確認日時</p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="データ連携を見る"
                      onClick={() => setTab("connections")}
                    >
                      <Icon name="link" size={18} />
                    </button>
                  </div>
                  {data.accounts.map((a, i) => (
                    <div className="account-row" key={a.id}>
                      <span className={`institution institution-${i % 4}`}>
                        {a.name.slice(0, 1)}
                      </span>
                      <div>
                        <strong>{a.name}</strong>
                        <small>
                          {sourceNames[a.source]} · {timeLabel(a.asOf)}
                          {a.kind === "broker" && " · 現金のみ"}
                        </small>
                      </div>
                      <b>{a.balance === null ? "未取得" : money(a.balance)}</b>
                    </div>
                  ))}
                  {!data.accounts.length && (
                    <p className="empty">口座データは未取得です</p>
                  )}
                </section>
              </div>
            </>
          )}
          {tab === "expenses" && (
            <>
              <div className="expense-summary">
                <div>
                  <span>確定支出 − 返金</span>
                  <strong>{money(total.spent)}</strong>
                </div>
                <div>
                  <span>未確定</span>
                  <strong>{money(total.pending)}</strong>
                </div>
                <div>
                  <span>予算残額</span>
                  <strong>{money(total.remaining)}</strong>
                </div>
                <label>
                  月間予算（円）
                  <input
                    aria-label="月間予算（円）"
                    type="number"
                    min="1"
                    max="100000000"
                    value={budget}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isSafeInteger(v) && v > 0 && v <= 100000000)
                        setBudget(v);
                    }}
                  />
                </label>
              </div>
              <div className="category-bars">
                {total.categories.map(([name, value]) => (
                  <div className="category" key={name}>
                    <span>{name}</span>
                    <strong>{money(value)}</strong>
                    <div className="progress-track">
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(0, (value / Math.max(1, total.spent + total.pending)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <section className="panel">
                <div className="transaction-toolbar">
                  <label className="search">
                    <Icon name="search" size={18} />
                    <input
                      aria-label="明細を検索"
                      placeholder="店舗・カテゴリ・口座を検索"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label="明細を絞り込む"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">すべての明細</option>
                    <option value="posted">確定</option>
                    <option value="pending">未確定</option>
                    <option value="expense">支出</option>
                    <option value="transfer">振替</option>
                    <option value="refund">返金</option>
                  </select>
                  <span>{entries.length}件</span>
                </div>
                {inspected && (
                  <div className="message">
                    分析に使用した明細を表示中
                    <button onClick={() => setInspected(null)}>
                      絞り込み解除
                    </button>
                  </div>
                )}
                {transactions()}
              </section>
              <p className="footnote">
                支出予測は（確定支出＋未確定支出−返金）÷経過日数×月の日数。収入・投資・振替・取消・置換済み速報は集計しません。将来日付の明細は当月集計に含めません。
              </p>
            </>
          )}
          {tab === "investments" && (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>保有資産</h2>
                    <p>NISA・特定・一般口座を分けて管理</p>
                  </div>
                  <span className="subtle-tag">
                    取得原価 {money(total.cost)}
                  </span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>銘柄 / 口座</th>
                        <th>区分</th>
                        <th className="align-right">取得原価</th>
                        <th className="align-right">評価額</th>
                        <th className="align-right">評価損益</th>
                        <th>価格確認</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.holdings.map((h) => (
                        <tr key={h.id}>
                          <td>
                            <strong>{h.name}</strong>
                            <small>
                              {h.ticker} ·{" "}
                              {
                                data.accounts.find((a) => a.id === h.accountId)
                                  ?.name
                              }
                            </small>
                          </td>
                          <td>
                            <span className="tag">{h.wrapper}</span>
                          </td>
                          <td className="align-right amount">
                            {money(h.cost)}
                          </td>
                          <td className="align-right amount">
                            {h.value === null ? "未取得" : money(h.value)}
                          </td>
                          <td
                            className={`align-right amount ${h.value !== null && h.value >= h.cost ? "positive" : ""}`}
                          >
                            {h.value === null
                              ? "算出不可"
                              : `${h.value >= h.cost ? "+" : ""}${money(h.value - h.cost)}`}
                          </td>
                          <td>
                            <small>
                              {timeLabel(h.asOf)}
                              <br />
                              {freshness(h.asOf)}
                            </small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.holdings.length && (
                    <p className="empty">
                      保有資産を取り込んでください。約定メールだけでは現在の全保有残高を確定できません。
                    </p>
                  )}
                </div>
              </section>
              <div className="panel allocation-panel">
                <h2>投資配分</h2>
                {data.holdings.map((h, i) => (
                  <div className="allocation-row" key={h.id}>
                    <span className={`allocation-dot dot-${i % 4}`} />
                    <span>{h.name}</span>
                    <div className="progress-track">
                      <div
                        style={{
                          width: `${((h.value ?? 0) / Math.max(1, total.investment)) * 100}%`,
                        }}
                      />
                    </div>
                    <strong>
                      {hidden
                        ? "••"
                        : h.value === null
                          ? "未取得"
                          : `${Math.round((h.value / Math.max(1, total.investment)) * 100)}%`}
                    </strong>
                  </div>
                ))}
              </div>
              <p className="footnote">
                取得原価は現在保有分の原価です。累計買付金額ではありません。評価損益は手数料・税金・実現損益を含みません。証券口座の残高には現金のみを入れ、保有評価額との二重計上を防ぎます。
              </p>
            </>
          )}
          {tab === "insights" && (
            <>
              <div className="section-intro">
                <span className="tag">常時利用可 · ルール分析</span>
                <p>
                  計算で検出した気づきです。各カードで使用した条件と明細を確認できます。
                </p>
              </div>
              <div className="insight-grid">
                {insights.map((item) => (
                  <article className="panel insight-card" key={item.id}>
                    <span
                      className={`tag ${item.level === "attention" ? "amber" : ""}`}
                    >
                      {item.level === "attention"
                        ? "△ 確認候補"
                        : "i データの整理"}
                    </span>
                    <h2>
                      {hidden
                        ? "金額を表示すると分析を確認できます"
                        : item.title}
                    </h2>
                    {!hidden && (
                      <>
                        <p>{item.detail}</p>
                        <div className="evidence">
                          <span>根拠・計算方法</span>
                          {item.evidence}
                        </div>
                        {item.entryIds.length > 0 && (
                          <button
                            className="text-button"
                            onClick={() => showEvidence(item.entryIds)}
                          >
                            対象の{item.entryIds.length}件を見る{" "}
                            <Icon name="chevron" size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </article>
                ))}
              </div>
              <section className="panel ai-panel">
                <div className="panel-heading">
                  <div>
                    <h2>
                      <Icon name="spark" /> ローカルAIによる解説
                    </h2>
                    <p>Ollama接続時に利用可能 · 未設定なら実行できません</p>
                  </div>
                  <span className="subtle-tag">任意</span>
                </div>
                <p>
                  AIには月別の集計数値だけを渡します。店舗名・口座番号・明細本文は渡しません。接続先はアプリサーバー内のローカルモデルです。
                </p>
                <label className="consent">
                  <input
                    type="checkbox"
                    checked={aiConsent}
                    onChange={(e) => setAiConsent(e.target.checked)}
                  />{" "}
                  集計数値をアプリサーバーのローカルAIで処理する
                </label>
                <button
                  className="button primary"
                  disabled={!aiConsent || aiBusy}
                  onClick={() => void askAI()}
                >
                  <Icon name="spark" size={16} />
                  {aiBusy ? "分析中…" : "集計データを解説する"}
                </button>
                {ai && (
                  <div className="ai-response" role="status">
                    {hidden ? "金額を非表示にしています" : ai}
                  </div>
                )}
                <p className="footnote">
                  AIの解釈には誤りがあり得ます。金額は上の計算結果と照合してください。売買注文や資金移動は行いません。
                </p>
              </section>
            </>
          )}
          {tab === "connections" && (
            <>
              <section className="panel connection-intro">
                <div>
                  <span className="eyebrow">DATA YOU CAN TRUST</span>
                  <h2>更新時刻まで見える、データ連携。</h2>
                  <p>
                    「画面を再取得した時刻」と「金融機関の残高を確認した時刻」は別です。
                    <br />
                    未接続の金融機関を、接続済みとは表示しません。
                  </p>
                </div>
                <button
                  className="button primary"
                  onClick={() => setImportOpen(true)}
                >
                  <Icon name="upload" size={16} />
                  ファイルを取り込む
                </button>
              </section>
              <div className="connection-grid">
                {data.accounts.map((a) => (
                  <article className="panel connection-card" key={a.id}>
                    <Icon
                      name={a.kind === "card" ? "card" : "wallet"}
                      size={25}
                    />
                    <h2>{a.name}</h2>
                    <span
                      className={`tag ${a.estimated || freshness(a.asOf) !== "24時間以内" ? "amber" : ""}`}
                    >
                      {data.mode === "demo"
                        ? "デモ・未接続"
                        : `${sourceNames[a.source]} · ${a.estimated ? "推定残高" : freshness(a.asOf)}`}
                    </span>
                    <dl>
                      <dt>残高 / 未払額</dt>
                      <dd>
                        {a.balance === null ? "未取得" : money(a.balance)}
                      </dd>
                      <dt>確認日時（日本時間）</dt>
                      <dd>{timeLabel(a.asOf)}</dd>
                      <dt>口座ID</dt>
                      <dd>{a.id}</dd>
                    </dl>
                  </article>
                ))}
              </div>
              <section className="panel capabilities">
                <h2>連携方法と現在の対応範囲</h2>
                <table>
                  <thead>
                    <tr>
                      <th>経路</th>
                      <th>状態</th>
                      <th>更新の仕組み</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>CSV / JSON</td>
                      <td>利用可能</td>
                      <td>手動取込・このタブ内で処理</td>
                    </tr>
                    <tr>
                      <td>Google Apps Script</td>
                      <td>{configured ? "接続設定あり" : "未設定"}</td>
                      <td>
                        認証付きAPI・画面表示中60秒ごとに保存済みデータを再取得
                      </td>
                    </tr>
                    <tr>
                      <td>銀行・証券の公式API</td>
                      <td>未実装・未接続</td>
                      <td>提供先の利用条件・契約と認証が必要</td>
                    </tr>
                    <tr>
                      <td>カード利用通知</td>
                      <td>GAS経由・楽天カード既存パーサー</td>
                      <td>メール取込周期に依存・速報と確定の照合が必要</td>
                    </tr>
                  </tbody>
                </table>
              </section>
              <div className="data-actions">
                <button
                  className="button primary"
                  onClick={() => {
                    setVaultError("");
                    setVaultOpen("save");
                  }}
                >
                  暗号化して端末に保存
                </button>
                <button
                  className="button"
                  disabled={!vaultExists}
                  onClick={() => {
                    setVaultError("");
                    setVaultOpen("unlock");
                  }}
                >
                  端末の保存データを開く
                </button>
                <button
                  className="button"
                  onClick={() =>
                    download(
                      "myfinance-backup.json",
                      JSON.stringify(data, null, 2),
                      "application/json",
                    )
                  }
                >
                  JSONを保存
                </button>
                <button
                  className="button"
                  onClick={() => {
                    replaceData(emptySnapshot());
                    setNotice(
                      "表示中のデータをクリアしました。元ファイル・連携先は変更していません。",
                    );
                  }}
                >
                  このタブのデータをクリア
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    replaceData(demo);
                    setError("");
                    setNotice("架空のデモデータを表示しています。");
                  }}
                >
                  デモに切り替える
                </button>
              </div>
            </>
          )}
          <footer className="footer">
            <span>
              <Icon name="shield" size={13} /> MyFinance · プライバシー優先
            </span>
            <span>
              {data.mode === "demo"
                ? "サンプルデータ / 金融機関は未接続"
                : `データ取得：${timeLabel(data.asOf)} / 各口座の確認日時は別記`}
            </span>
          </footer>
        </main>
      </div>
      {vaultOpen && (
        <div className="modal-backdrop">
          <section
            ref={dialog}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vault-title"
          >
            <div className="panel-heading">
              <h2 id="vault-title">
                {vaultOpen === "save"
                  ? "データを暗号化して保存"
                  : "保存データを開く"}
              </h2>
              <button
                className="icon-button"
                aria-label="保存画面を閉じる"
                disabled={vaultBusy}
                onClick={() => {
                  setVaultOpen(null);
                  setPassphrase("");
                }}
              >
                <Icon name="close" />
              </button>
            </div>
            <p>
              このブラウザー内にAES-GCMで暗号化して保存します。パスフレーズは保存・送信しません。忘れた場合は復元できません。
              {vaultOpen === "save" &&
                vaultExists &&
                "既存の端末保存データを上書きします。"}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void vaultAction();
              }}
            >
              <label className="vault-label">
                パスフレーズ（12文字以上）
                <input
                  autoFocus
                  type="password"
                  autoComplete={
                    vaultOpen === "save" ? "new-password" : "current-password"
                  }
                  minLength={12}
                  required
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
              </label>
              {vaultError && (
                <p className="message error" role="alert">
                  {vaultError}
                </p>
              )}
              <p className="footnote">
                ブラウザーのデータ削除で消えます。暗号化は共有端末の覗き見や、実行中の悪意ある拡張機能を防ぐものではありません。自動保存ではないため、変更後は再保存してください。
              </p>
              <div className="modal-actions">
                <button
                  className="button primary"
                  type="submit"
                  disabled={vaultBusy || passphrase.length < 12}
                >
                  {vaultBusy
                    ? "処理中…"
                    : vaultOpen === "save"
                      ? "暗号化して保存する"
                      : "復号して開く"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {importOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setImportOpen(false);
          }}
        >
          <section
            ref={dialog}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") setImportOpen(false);
            }}
          >
            <div className="panel-heading">
              <div>
                <p className="eyebrow">IMPORT YOUR DATA</p>
                <h2 id="import-title">あなたのデータで始める</h2>
              </div>
              <button
                className="icon-button"
                autoFocus
                aria-label="取込画面を閉じる"
                onClick={() => setImportOpen(false)}
              >
                <Icon name="close" />
              </button>
            </div>
            <p>
              CSVは <b>①口座 → ②保有資産 → ③明細</b>{" "}
              の順に取り込みます。テンプレートのサンプル行を、ご自身のデータに置き換えてください。
            </p>
            <div className="template-buttons">
              <button className="button" onClick={() => template("accounts")}>
                ① 口座CSV
              </button>
              <button className="button" onClick={() => template("holdings")}>
                ② 保有資産CSV
              </button>
              <button className="button" onClick={() => template("entries")}>
                ③ 明細CSV
              </button>
            </div>
            <div className="import-zone">
              <Icon name="upload" size={28} />
              <strong>CSVまたはバックアップJSONを選択</strong>
              <p>UTF-8 · 2MBまで · サーバーへ自動送信しません</p>
              <input
                ref={input}
                type="file"
                accept=".csv,.json"
                aria-label="取込ファイル"
                onChange={(e) => void onImport(e.target.files?.[0])}
              />
            </div>
            {error && (
              <p className="message error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="message" role="status">
                {notice}
              </p>
            )}
            <p className="footnote">
              最初のCSV取込でデモを置換します。JSONは全体を置換します。同一IDのCSVは重複取込しません。保存前のデータは再読込すると消えます。取込後はデータ連携画面から暗号化保存できます。JSON保存は平文のため、保管先に注意してください。
            </p>
            <div className="modal-actions">
              <button
                className="button"
                onClick={() =>
                  download(
                    "myfinance-backup.json",
                    JSON.stringify(data, null, 2),
                    "application/json",
                  )
                }
              >
                JSONを保存
              </button>
              <button
                className="button primary"
                onClick={() => setImportOpen(false)}
              >
                画面に戻る
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
