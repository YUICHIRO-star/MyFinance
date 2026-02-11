/**
 * ============================================================
 * MyFinance - Yahoo! Finance Scraper (Enrichment Layer)
 * ============================================================
 * Yahoo!ファイナンスから投資信託の基準価額（NAV）を取得する。
 * 時系列ページをスクレイピングし、指定日の基準価額を返す。
 * ============================================================
 */

/**
 * 指定した銘柄・日付の基準価額（NAV）を取得する。
 *
 * @param {string} ticker - Yahoo! Finance ティッカーコード
 * @param {Date} tradeDate - 約定日
 * @returns {number|null} 基準価額（円）。取得失敗/未反映時は null
 */
function fetchNavPrice(ticker, tradeDate) {
    const MODULE = 'YahooScraper';

    try {
        // Yahoo!ファイナンスの時系列ページURL構築
        const url = buildHistoryUrl(ticker, tradeDate);
        logInfo(MODULE, 'Yahoo!ファイナンスにリクエスト送信', { url: url, ticker: ticker });

        const response = UrlFetchApp.fetch(url, {
            muteHttpExceptions: true,
            headers: {
                'User-Agent': CONFIG.yahoo.userAgent,
            },
        });

        const statusCode = response.getResponseCode();
        if (statusCode !== 200) {
            logError(MODULE, `HTTPステータスエラー: ${statusCode}`, { ticker: ticker, url: url });
            return null;
        }

        const html = response.getContentText('UTF-8');
        const nav = extractNavFromHtml(html, tradeDate);

        if (nav === null) {
            logWarn(MODULE, '指定日の基準価額が見つかりません（未反映の可能性）', {
                ticker: ticker,
                date: formatDate(tradeDate),
            });
            return null;
        }

        logInfo(MODULE, '基準価額を取得', {
            ticker: ticker,
            date: formatDate(tradeDate),
            nav: nav,
        });

        return nav;

    } catch (e) {
        logError(MODULE, 'スクレイピング中にエラーが発生', {
            ticker: ticker,
            error: e.message,
            stack: e.stack,
        }, true);
        return null;
    }
}

/**
 * Yahoo!ファイナンスの時系列ページURLを構築する。
 * 約定日を含む前後数日の範囲でデータを取得する。
 *
 * @param {string} ticker
 * @param {Date} tradeDate
 * @returns {string} URL
 */
function buildHistoryUrl(ticker, tradeDate) {
    // 約定日の7日前から当日までの範囲を指定
    const fromDate = new Date(tradeDate);
    fromDate.setDate(fromDate.getDate() - 7);

    const from = formatDateCompact(fromDate);
    const to = formatDateCompact(tradeDate);

    // Yahoo!ファイナンス (JP) の時系列ページ
    // URL形式: /quote/{ticker}/history?from={YYYYMMDD}&to={YYYYMMDD}&timeFrame=d
    return `${CONFIG.yahoo.baseUrl}${ticker}${CONFIG.yahoo.historySuffix}?from=${from}&to=${to}&timeFrame=d`;
}

/**
 * HTMLから指定日の基準価額を抽出する。
 * Yahoo!ファイナンスの時系列テーブル構造に対応。
 *
 * ※ DOM構造の変更リスクに対応するため、複数の抽出手法をフォールバックで試行。
 *
 * @param {string} html - HTMLコンテンツ
 * @param {Date} targetDate - 対象日付
 * @returns {number|null} 基準価額
 */
function extractNavFromHtml(html, targetDate) {
    const MODULE = 'YahooScraper';

    const targetDateStr = formatDate(targetDate);
    // 「2024/01/15」形式と「2024年1月15日」形式の両方に対応
    const targetY = targetDate.getFullYear();
    const targetM = targetDate.getMonth() + 1;
    const targetD = targetDate.getDate();

    // 検索用の日付パターン（複数フォーマットに対応）
    const datePatterns = [
        `${targetY}/${String(targetM).padStart(2, '0')}/${String(targetD).padStart(2, '0')}`,
        `${targetY}年${targetM}月${targetD}日`,
        `${targetY}年${String(targetM).padStart(2, '0')}月${String(targetD).padStart(2, '0')}日`,
    ];

    // ── 方法1: テーブル行ベースの抽出 ──
    // <tr> 内に日付があり、次のセルに基準価額がある想定
    for (const datePattern of datePatterns) {
        // 日付を含む行を探す
        const escapedDate = datePattern.replace(/[\/\(\)]/g, '\\$&');
        const rowPattern = new RegExp(
            `<tr[^>]*>[\\s\\S]*?${escapedDate}[\\s\\S]*?</tr>`,
            'i'
        );

        const rowMatch = html.match(rowPattern);
        if (rowMatch) {
            // 行内の <td> を抽出
            const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
            const cells = [];
            let tdMatch;
            while ((tdMatch = tdPattern.exec(rowMatch[0])) !== null) {
                cells.push(tdMatch[1].replace(/<[^>]+>/g, '').trim());
            }

            // 基準価額は通常2列目（日付の次）
            if (cells.length >= 2) {
                const navStr = cells[1];
                const nav = parseNavValue(navStr);
                if (nav) {
                    logInfo(MODULE, '方法1（テーブル行）で基準価額を抽出', { nav: nav });
                    return nav;
                }
            }
        }
    }

    // ── 方法2: 疎い正規表現による抽出 ──
    // 日付の近傍にある数値（4桁以上のカンマ区切り）を基準価額とみなす
    for (const datePattern of datePatterns) {
        const escapedDate = datePattern.replace(/[\/\(\)]/g, '\\$&');
        const loosePattern = new RegExp(
            escapedDate + '[\\s\\S]{0,200}?([0-9,]{4,})',
            'i'
        );

        const looseMatch = html.match(loosePattern);
        if (looseMatch) {
            const nav = parseNavValue(looseMatch[1]);
            if (nav && nav >= 100 && nav <= 999999) {
                // 基準価額として妥当な範囲（100円～999,999円）
                logInfo(MODULE, '方法2（疎い正規表現）で基準価額を抽出', { nav: nav });
                return nav;
            }
        }
    }

    logWarn(MODULE, '基準価額の抽出に失敗', { targetDate: targetDateStr });
    return null;
}

/**
 * 基準価額文字列をパースして数値にする。
 * "24,563" → 24563
 *
 * @param {string} str
 * @returns {number|null}
 */
function parseNavValue(str) {
    if (!str) return null;
    const cleaned = str.replace(/[,\s]/g, '');
    const value = parseInt(cleaned, 10);
    return isNaN(value) ? null : value;
}

/**
 * 口数を計算する。
 * 購入口数 = Round(購入金額 / 基準価額 × 10000)
 *
 * @param {number} amount - 購入金額（円）
 * @param {number} nav - 基準価額（円）
 * @returns {number} 口数
 */
function calculateQuantity(amount, nav) {
    if (!nav || nav <= 0) return 0;
    return Math.round((amount / nav) * 10000);
}
