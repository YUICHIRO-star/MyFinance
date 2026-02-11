/**
 * ============================================================
 * MyFinance - Email Parser (Ingestion Layer)
 * ============================================================
 * Gmailから資産管理ラベル付きの未読メールを取得し、
 * 約定日・金額・銘柄名を抽出する。
 * ============================================================
 */

/**
 * 未読メールを検索し、解析結果を配列で返す。
 * 解析に失敗したメールは既読にせず、次回バッチで再試行される。
 *
 * @returns {Array<{message: GmailMessage, tradeDate: Date, amount: number, fundKey: string, fundInfo: Object}>}
 */
function fetchAndParseEmails() {
    const MODULE = 'EmailParser';

    logInfo(MODULE, 'メール検索を開始', { query: CONFIG.gmail.searchQuery });

    const threads = GmailApp.search(CONFIG.gmail.searchQuery, 0, CONFIG.gmail.maxThreads);

    if (threads.length === 0) {
        logInfo(MODULE, '未処理のメールはありません');
        return [];
    }

    logInfo(MODULE, `${threads.length} 件のスレッドを検出`);

    const results = [];

    for (const thread of threads) {
        const messages = thread.getMessages();

        for (const message of messages) {
            if (message.isUnread()) {
                try {
                    const parsed = parseEmailBody(message);
                    if (parsed) {
                        results.push({
                            message: message,
                            ...parsed,
                        });
                    } else {
                        logWarn(MODULE, 'メール本文の解析に失敗（スキップ）', {
                            subject: message.getSubject(),
                            date: message.getDate().toISOString(),
                        });
                        // 解析失敗 → 未読のまま残す（次回再試行）
                    }
                } catch (e) {
                    logError(MODULE, 'メール処理中に例外が発生', {
                        subject: message.getSubject(),
                        error: e.message,
                        stack: e.stack,
                    }, true);
                }
            }
        }
    }

    logInfo(MODULE, `${results.length} 件の取引データを抽出`);
    return results;
}

/**
 * 単一メールの本文を解析し、取引情報を抽出する。
 *
 * @param {GmailMessage} message
 * @returns {{tradeDate: Date, amount: number, fundKey: string, fundInfo: Object}|null}
 */
function parseEmailBody(message) {
    const MODULE = 'EmailParser';
    const body = message.getPlainBody();
    const subject = message.getSubject();

    // ── Step 1: 約定日の抽出 ──
    const tradeDate = extractTradeDate(body, subject);
    if (!tradeDate) {
        logWarn(MODULE, '約定日を検出できません', { subject: subject });
        return null;
    }

    // ── Step 2: 取引金額の抽出 ──
    const amount = extractAmount(body);
    if (!amount || amount <= 0) {
        logWarn(MODULE, '取引金額を検出できません', { subject: subject });
        return null;
    }

    // ── Step 3: 銘柄の特定 ──
    const fundMatch = identifyFund(body, subject);
    if (!fundMatch) {
        logWarn(MODULE, '銘柄を特定できません', { subject: subject });
        return null;
    }

    logInfo(MODULE, '取引データを抽出', {
        date: formatDate(tradeDate),
        amount: amount,
        fund: fundMatch.key,
    });

    return {
        tradeDate: tradeDate,
        amount: amount,
        fundKey: fundMatch.key,
        fundInfo: fundMatch.info,
    };
}

/**
 * メール本文から約定日を抽出する。
 * 「約定日」「受渡日」「買付日」などのキーワード近傍を優先的に検索。
 *
 * @param {string} body - メール本文
 * @param {string} subject - メール件名
 * @returns {Date|null}
 */
function extractTradeDate(body, subject) {
    // 優先パターン: 「約定日」キーワードの直後にある日付
    const contextPatterns = [
        /約定日[：:\s]*(\d{4}[\/\-年]\d{1,2}[\/\-月]\d{1,2}日?)/,
        /買付日[：:\s]*(\d{4}[\/\-年]\d{1,2}[\/\-月]\d{1,2}日?)/,
        /受渡日[：:\s]*(\d{4}[\/\-年]\d{1,2}[\/\-月]\d{1,2}日?)/,
        /注文日[：:\s]*(\d{4}[\/\-年]\d{1,2}[\/\-月]\d{1,2}日?)/,
    ];

    for (const pattern of contextPatterns) {
        const match = body.match(pattern);
        if (match) {
            const date = parseJapaneseDate(match[1]);
            if (date) return date;
        }
    }

    // フォールバック: 本文中の最初の日付を使用
    const genericPattern = /(\d{4}[\/\-年]\d{1,2}[\/\-月]\d{1,2}日?)/;
    const bodyMatch = body.match(genericPattern);
    if (bodyMatch) {
        const date = parseJapaneseDate(bodyMatch[1]);
        if (date) return date;
    }

    // 最終フォールバック: 件名から抽出
    const subjectMatch = subject.match(genericPattern);
    if (subjectMatch) {
        return parseJapaneseDate(subjectMatch[1]);
    }

    return null;
}

/**
 * メール本文から取引金額を抽出する。
 * 「買付金額」「約定金額」「購入金額」などのキーワード近傍を優先。
 *
 * @param {string} body
 * @returns {number|null}
 */
function extractAmount(body) {
    // 優先パターン: キーワード + 金額
    const contextPatterns = [
        /(?:買付金額|約定金額|購入金額|受渡金額|注文金額)[：:\s]*[¥￥]?\s*([0-9,０-９，]+)\s*円?/,
        /(?:金額)[：:\s]*[¥￥]?\s*([0-9,０-９，]+)\s*円/,
    ];

    for (const pattern of contextPatterns) {
        const match = body.match(pattern);
        if (match) {
            const amount = parseAmount(match[0]);
            if (amount) return amount;
        }
    }

    // フォールバック: 本文中の最大の金額っぽい数値を使用
    const allAmounts = [];
    const genericPattern = /[¥￥]?\s*([0-9,０-９，]{3,})\s*円/g;
    let m;
    while ((m = genericPattern.exec(body)) !== null) {
        const val = parseAmount(m[0]);
        if (val && val > 0) allAmounts.push(val);
    }

    if (allAmounts.length > 0) {
        // 最大の金額を投資金額とみなす（手数料等は通常少額）
        return Math.max(...allAmounts);
    }

    return null;
}

/**
 * メール本文・件名から投資信託の銘柄を特定する。
 * CONFIG.fundMapping のキーワードとマッチング。
 *
 * @param {string} body
 * @param {string} subject
 * @returns {{key: string, info: Object}|null}
 */
function identifyFund(body, subject) {
    const combined = subject + '\n' + body;

    // 最長一致を優先（「eMAXIS Slim 全世界株式」が「eMAXIS Slim」に引っかからないように）
    const keys = Object.keys(CONFIG.fundMapping)
        .sort((a, b) => b.length - a.length);

    for (const key of keys) {
        if (combined.includes(key)) {
            return {
                key: key,
                info: CONFIG.fundMapping[key],
            };
        }
    }

    return null;
}
