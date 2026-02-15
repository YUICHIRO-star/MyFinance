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

// ============================================================
// 銀行メール解析 (三井住友銀行 対応)
// ============================================================

/**
 * 銀行通知メールを取得・解析する。
 * 三井住友銀行の入出金通知メールに対応。
 *
 * メールフォーマット例（振込入金）:
 *   件名: 【三井住友銀行】振込入金のお知らせ
 *   本文:
 *     ○○さま
 *     三井住友銀行より、以下の振込入金についてお知らせします。
 *     入金口座 ： ○○支店 普通 口座番号○○○○○○○
 *     入金日 ： ○○年○月○日
 *     金額 ： 123,456円
 *     内容 ： 振込 カ）ミツイスミトモギンコウ
 *
 * メールフォーマット例（口座出金）:
 *   件名: 【三井住友銀行】口座出金通知のお知らせ
 *   本文:
 *     ○○さま
 *     三井住友銀行より、キャッシュカードでの出金についてお知らせします。
 *     出金口座 ： ○○支店 普通 口座番号○○○○○○○
 *     出金日 ： ○○年○月○日
 *     出金額 ： 123,456円
 *     内容 ： カード
 *
 * @returns {Array<{message: GmailMessage, date: Date, amount: number, description: string}>}
 */
function fetchAndParseBankEmails() {
    const MODULE = 'BankEmailParser';

    logInfo(MODULE, '銀行メール検索を開始', { query: CONFIG.bank.searchQuery });

    const threads = GmailApp.search(CONFIG.bank.searchQuery, 0, CONFIG.gmail.maxThreads);

    if (threads.length === 0) {
        logInfo(MODULE, '未処理の銀行メールはありません');
        return [];
    }

    logInfo(MODULE, `${threads.length} 件の銀行メールスレッドを検出`);

    const results = [];

    for (const thread of threads) {
        const messages = thread.getMessages();

        for (const message of messages) {
            if (message.isUnread()) {
                try {
                    const parsed = parseBankEmailBody(message);
                    if (parsed) {
                        results.push({
                            message: message,
                            ...parsed,
                        });
                    } else {
                        logWarn(MODULE, '銀行メール解析失敗（スキップ）', {
                            subject: message.getSubject(),
                            date: message.getDate().toISOString(),
                        });
                    }
                } catch (e) {
                    logError(MODULE, '銀行メール処理中に例外', {
                        subject: message.getSubject(),
                        error: e.message,
                        stack: e.stack,
                    }, true);
                }
            }
        }
    }

    logInfo(MODULE, `${results.length} 件の銀行取引を抽出`);
    return results;
}

/**
 * 銀行通知メール本文を解析する。
 * まず getPlainBody() を試し、取得できなければ HTML をテキスト化して解析。
 *
 * @param {GmailMessage} message
 * @returns {{date: Date, amount: number, description: string}|null}
 */
function parseBankEmailBody(message) {
    const MODULE = 'BankEmailParser';
    const subject = message.getSubject();

    // テキスト本文を取得（HTML フォールバック付き）
    let body = message.getPlainBody();
    if (!body || body.trim().length < 20) {
        // HTML メールの場合、タグを除去してテキスト化
        const html = message.getBody();
        body = stripHtmlTags(html);
    }

    if (!body) {
        logWarn(MODULE, 'メール本文を取得できません', { subject });
        return null;
    }

    // ── 入金 or 出金の判定 ──
    const isDeposit = /振込入金|入金のお知らせ|入金通知/.test(subject + body);
    const isWithdrawal = /口座出金|出金通知|引落/.test(subject + body);

    if (!isDeposit && !isWithdrawal) {
        logWarn(MODULE, '入金・出金メールとして認識できません', { subject });
        return null;
    }

    // ── 日付の抽出 ──
    let txDate = null;
    const datePatterns = [
        /(?:入金日|出金日|引落日)[：:\s]*(\d{2,4}年\d{1,2}月\d{1,2}日)/,
        /(?:入金日|出金日|引落日)[：:\s]*(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/,
    ];

    for (const pattern of datePatterns) {
        const match = body.match(pattern);
        if (match) {
            txDate = parseJapaneseDate(match[1]);
            if (txDate) break;
        }
    }

    // フォールバック: メール受信日
    if (!txDate) {
        txDate = message.getDate();
        logWarn(MODULE, '日付検出できず、メール受信日を使用', { date: txDate });
    }

    // ── 金額の抽出 ──
    let txAmount = null;
    const amountPatterns = [
        /(?:金額|出金額|入金額|引落額)[：:\s]*[¥￥]?\s*([0-9,０-９，]+)\s*円/,
        /(?:金額|出金額|入金額|引落額)[：:\s]*([0-9,０-９，]+)/,
    ];

    for (const pattern of amountPatterns) {
        const match = body.match(pattern);
        if (match) {
            txAmount = parseAmount(match[0]);
            if (txAmount && txAmount > 0) break;
        }
    }

    if (!txAmount || txAmount <= 0) {
        logWarn(MODULE, '金額を検出できません', { subject });
        return null;
    }

    // ── 内容（説明）の抽出 ──
    let description = '';
    const contentMatch = body.match(/内容[：:\s]*(.+?)(?:\n|$)/);
    if (contentMatch) {
        description = contentMatch[1].trim();
    } else {
        // 件名から抽出
        description = subject
            .replace(/【三井住友銀行】/, '')
            .replace(/のお知らせ/, '')
            .trim();
    }

    // 出金は負数にする
    const finalAmount = isWithdrawal ? -txAmount : txAmount;

    logInfo(MODULE, '銀行取引を抽出', {
        type: isDeposit ? '入金' : '出金',
        date: formatDate(txDate),
        amount: finalAmount,
        desc: description,
    });

    return {
        date: txDate,
        amount: finalAmount,
        description: description,
    };
}

/**
 * HTMLタグを除去してプレーンテキストに変換する。
 * GAS では DOMParser が使えないため、正規表現で対応。
 *
 * @param {string} html
 * @returns {string}
 */
function stripHtmlTags(html) {
    if (!html) return '';

    return html
        // <br>, <p>, <div> の閉じタグを改行に
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:p|div|tr|li)>/gi, '\n')
        // <td> をスペースで区切る
        .replace(/<\/td>/gi, ' ')
        // 残りのHTMLタグを除去
        .replace(/<[^>]+>/g, '')
        // HTMLエンティティをデコード
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&yen;/gi, '¥')
        // 連続空白・空行を整理
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// ============================================================
// 証券会社メール解析 (楽天証券 / SBI証券)
// ============================================================

/**
 * 全証券会社の約定通知メールを取得・解析する。
 * 各ブローカーの検索クエリを使い、送信元に応じてパーサーを振り分ける。
 *
 * @returns {Array<{message: GmailMessage, tradeDate: Date, ticker: string,
 *           securityName: string, quantity: number, price: number,
 *           amount: number, action: string, broker: string}>}
 */
function fetchAndParseSecuritiesEmails() {
    const MODULE = 'SecuritiesParser';
    const results = [];

    for (const [brokerKey, brokerConfig] of Object.entries(CONFIG.brokers)) {
        logInfo(MODULE, `${brokerKey} メール検索`, { query: brokerConfig.searchQuery });

        const threads = GmailApp.search(brokerConfig.searchQuery, 0, CONFIG.gmail.maxThreads);

        if (threads.length === 0) {
            logInfo(MODULE, `${brokerKey}: 未処理メールなし`);
            continue;
        }

        logInfo(MODULE, `${brokerKey}: ${threads.length} 件検出`);

        for (const thread of threads) {
            for (const message of thread.getMessages()) {
                if (!message.isUnread()) continue;

                try {
                    let parsed = null;

                    if (brokerKey === 'rakuten') {
                        parsed = parseRakutenEmail(message);
                    } else if (brokerKey === 'sbi') {
                        parsed = parseSBIEmail(message);
                    }

                    if (parsed) {
                        results.push({
                            message: message,
                            broker: brokerKey,
                            ...parsed,
                        });
                    } else {
                        logWarn(MODULE, `${brokerKey} メール解析失敗`, {
                            subject: message.getSubject(),
                        });
                    }
                } catch (e) {
                    logError(MODULE, `${brokerKey} メール処理例外`, {
                        subject: message.getSubject(),
                        error: e.message,
                    }, true);
                }
            }
        }
    }

    logInfo(MODULE, `合計 ${results.length} 件の約定データを抽出`);
    return results;
}

/**
 * 楽天証券の約定通知メールを解析する。
 *
 * 期待フォーマット（詳細通知）:
 *   銘柄名: eMAXIS Slim 米国株式(S&P500)
 *   銘柄コード: 0331418A
 *   取引: 買付
 *   約定単価: 24,567円
 *   約定数量: 10,000口 / 100株
 *   約定日時: 2025/01/15 09:00:15
 *
 * @param {GmailMessage} message
 * @returns {Object|null}
 */
function parseRakutenEmail(message) {
    const MODULE = 'Rakuten';

    let body = message.getPlainBody();
    if (!body || body.trim().length < 30) {
        body = stripHtmlTags(message.getBody());
    }

    if (!body) return null;

    // ── 約定日時 ──
    let tradeDate = null;
    const dateMatch = body.match(/約定日時[：:\s]*(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/);
    if (dateMatch) {
        tradeDate = parseJapaneseDate(dateMatch[1]);
    }
    // フォールバック: 約定日
    if (!tradeDate) {
        const dateMatch2 = body.match(/約定日[：:\s]*(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/);
        if (dateMatch2) tradeDate = parseJapaneseDate(dateMatch2[1]);
    }
    if (!tradeDate) {
        tradeDate = message.getDate();
    }

    // ── 銘柄 ──
    let securityName = '';
    let ticker = '';

    // 投資信託 or 株式の銘柄名
    const nameMatch = body.match(/銘柄名[：:\s]*(.+?)[\r\n]/);
    if (nameMatch) {
        securityName = nameMatch[1].trim();
    }

    // 銘柄コード
    const codeMatch = body.match(/銘柄コード[：:\s]*([A-Z0-9]+)/i);
    if (codeMatch) {
        ticker = codeMatch[1].trim();
    }

    // fundMapping からのマッチング（投資信託の場合）
    if (!ticker) {
        const fundMatch = identifyFund(body, message.getSubject());
        if (fundMatch) {
            securityName = securityName || fundMatch.key;
            ticker = fundMatch.info.ticker;
        }
    }

    if (!securityName && !ticker) return null;

    // ── 売買区分 ──
    let action = 'buy';
    if (/売却|売付/.test(body)) action = 'sell';

    // ── 約定単価 ──
    let price = 0;
    const priceMatch = body.match(/約定単価[：:\s]*[¥￥]?\s*([0-9,０-９，.]+)\s*円?/);
    if (priceMatch) {
        price = parseAmount(priceMatch[0]) || 0;
    }
    // フォールバック: 約定価格 / 価格
    if (!price) {
        const priceMatch2 = body.match(/(?:約定価格|価格)[：:\s]*[¥￥]?\s*([0-9,０-９，.]+)\s*円?/);
        if (priceMatch2) price = parseAmount(priceMatch2[0]) || 0;
    }

    // ── 数量 ──
    let quantity = 0;
    const qtyMatch = body.match(/(?:約定数量|数量)[：:\s]*([0-9,０-９，.]+)\s*(?:口|株)?/);
    if (qtyMatch) {
        quantity = parseAmount(qtyMatch[0]) || 0;
    }

    // ── 約定金額 ──
    let amount = 0;
    const amtMatch = body.match(/(?:約定金額|受渡金額|買付金額)[：:\s]*[¥￥]?\s*([0-9,０-９，]+)\s*円?/);
    if (amtMatch) {
        amount = parseAmount(amtMatch[0]) || 0;
    }
    // フォールバック: 単価 × 数量
    if (!amount && price > 0 && quantity > 0) {
        amount = price * quantity;
    }

    if (amount <= 0) return null;

    logInfo(MODULE, '楽天証券 約定抽出', {
        name: securityName, ticker, action, price, quantity, amount,
        date: formatDate(tradeDate),
    });

    return {
        tradeDate,
        securityName,
        ticker,
        action,
        price,
        quantity,
        amount: action === 'sell' ? -amount : amount,
    };
}

/**
 * SBI証券の約定通知メールを解析する。
 *
 * 期待フォーマット:
 *   件名: 【SBI証券】約定通知（国内株式）
 *   本文:
 *     ■約定内容
 *     約定日：2025/01/15
 *     取引：買付
 *     銘柄名（銘柄コード）：トヨタ自動車（7203）
 *     数量：100株
 *     価格：2,845.0円
 *
 * @param {GmailMessage} message
 * @returns {Object|null}
 */
function parseSBIEmail(message) {
    const MODULE = 'SBI';

    let body = message.getPlainBody();
    if (!body || body.trim().length < 30) {
        body = stripHtmlTags(message.getBody());
    }

    if (!body) return null;

    // ── 約定日 ──
    let tradeDate = null;
    const dateMatch = body.match(/約定日[：:\s]*(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/);
    if (dateMatch) {
        tradeDate = parseJapaneseDate(dateMatch[1]);
    }
    if (!tradeDate) {
        tradeDate = message.getDate();
    }

    // ── 銘柄名（銘柄コード）── SBI特有のフォーマット
    let securityName = '';
    let ticker = '';

    // パターン1: 銘柄名（銘柄コード）：トヨタ自動車（7203）
    const sbiNameMatch = body.match(/銘柄名[（(]銘柄コード[）)][：:\s]*(.+?)[（(](\d{4,})[）)]/);
    if (sbiNameMatch) {
        securityName = sbiNameMatch[1].trim();
        ticker = sbiNameMatch[2].trim();
    }

    // パターン2: 銘柄名だけ、コードだけ
    if (!securityName) {
        const nameOnly = body.match(/銘柄名[：:\s]*(.+?)[\r\n]/);
        if (nameOnly) securityName = nameOnly[1].trim();
    }
    if (!ticker) {
        const codeOnly = body.match(/銘柄コード[：:\s]*([A-Z0-9]+)/i);
        if (codeOnly) ticker = codeOnly[1].trim();
    }

    // fundMapping からのマッチング（投資信託の場合）
    if (!ticker) {
        const fundMatch = identifyFund(body, message.getSubject());
        if (fundMatch) {
            securityName = securityName || fundMatch.key;
            ticker = fundMatch.info.ticker;
        }
    }

    if (!securityName && !ticker) return null;

    // ── 売買区分 ──
    let action = 'buy';
    const actionMatch = body.match(/取引[：:\s]*(買付|売却|買い|売り)/);
    if (actionMatch && /売却|売り/.test(actionMatch[1])) {
        action = 'sell';
    }

    // ── 価格 ──
    let price = 0;
    const priceMatch = body.match(/価格[：:\s]*[¥￥]?\s*([0-9,０-９，.]+)\s*円?/);
    if (priceMatch) {
        price = parseAmount(priceMatch[0]) || 0;
    }

    // ── 数量 ──
    let quantity = 0;
    const qtyMatch = body.match(/数量[：:\s]*([0-9,０-９，.]+)\s*(?:口|株)?/);
    if (qtyMatch) {
        quantity = parseAmount(qtyMatch[0]) || 0;
    }

    // ── 金額（受渡金額 or 計算） ──
    let amount = 0;
    const amtMatch = body.match(/(?:約定金額|受渡金額|買付金額)[：:\s]*[¥￥]?\s*([0-9,０-９，]+)\s*円?/);
    if (amtMatch) {
        amount = parseAmount(amtMatch[0]) || 0;
    }
    if (!amount && price > 0 && quantity > 0) {
        amount = price * quantity;
    }

    if (amount <= 0) return null;

    logInfo(MODULE, 'SBI証券 約定抽出', {
        name: securityName, ticker, action, price, quantity, amount,
        date: formatDate(tradeDate),
    });

    return {
        tradeDate,
        securityName,
        ticker,
        action,
        price,
        quantity,
        amount: action === 'sell' ? -amount : amount,
    };
}

// ============================================================
// クレジットカードメール解析 (楽天カード)
// ============================================================

/**
 * クレジットカード利用通知メールを取得・解析する。
 *
 * 楽天カード メールフォーマット:
 *
 * 【速報版】:
 *   件名: 【速報版】カード利用のお知らせ（楽天カード）
 *   ご利用日: 2025/01/15
 *   ご利用金額: 3,456円
 *   ご利用者: 会員ご本人様
 *   ※ご利用先は記載なし
 *
 * 【通常版】:
 *   件名: カード利用お知らせメール（楽天カード）
 *   ご利用日: 2025/01/15
 *   ご利用金額: 3,456円
 *   ご利用先: Amazon.co.jp
 *   ご利用者: 会員ご本人様
 *   お支払い方法: 1回払い
 *
 * @returns {Array<{message: GmailMessage, date: Date, amount: number,
 *           merchant: string, paymentMethod: string, cardName: string, isExpress: boolean}>}
 */
function fetchAndParseCreditCardEmails() {
    const MODULE = 'CreditCardParser';
    const results = [];

    for (const [cardKey, cardConfig] of Object.entries(CONFIG.creditCards)) {
        logInfo(MODULE, `${cardKey} メール検索`, { query: cardConfig.searchQuery });

        const threads = GmailApp.search(cardConfig.searchQuery, 0, CONFIG.gmail.maxThreads);

        if (threads.length === 0) {
            logInfo(MODULE, `${cardKey}: 未処理メールなし`);
            continue;
        }

        logInfo(MODULE, `${cardKey}: ${threads.length} 件検出`);

        for (const thread of threads) {
            for (const message of thread.getMessages()) {
                if (!message.isUnread()) continue;

                try {
                    let parsed = null;

                    if (cardKey === 'rakuten') {
                        parsed = parseRakutenCardEmail(message);
                    }

                    if (parsed) {
                        results.push({
                            message: message,
                            cardName: cardKey,
                            ...parsed,
                        });
                    } else {
                        logWarn(MODULE, `${cardKey} メール解析失敗`, {
                            subject: message.getSubject(),
                        });
                    }
                } catch (e) {
                    logError(MODULE, `${cardKey} メール処理例外`, {
                        subject: message.getSubject(),
                        error: e.message,
                    }, true);
                }
            }
        }
    }

    logInfo(MODULE, `合計 ${results.length} 件のカード利用を抽出`);
    return results;
}

/**
 * 楽天カードの利用通知メールを解析する。
 * 速報版（ご利用先なし）と通常版（ご利用先あり）の両方に対応。
 *
 * @param {GmailMessage} message
 * @returns {{date: Date, amount: number, merchant: string, paymentMethod: string, isExpress: boolean}|null}
 */
function parseRakutenCardEmail(message) {
    const MODULE = 'RakutenCard';
    const subject = message.getSubject();

    // テキスト本文を取得（HTML フォールバック付き）
    let body = message.getPlainBody();
    if (!body || body.trim().length < 30) {
        body = stripHtmlTags(message.getBody());
    }

    if (!body) {
        logWarn(MODULE, 'メール本文を取得できません', { subject });
        return null;
    }

    // 速報版かどうか
    const isExpress = /速報版/.test(subject);

    // ── ご利用日 ──
    let txDate = null;
    const dateMatch = body.match(/ご利用日[：:\s]*(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/);
    if (dateMatch) {
        txDate = parseJapaneseDate(dateMatch[1]);
    }
    if (!txDate) {
        // 年月日形式
        const dateMatch2 = body.match(/ご利用日[：:\s]*(\d{2,4}年\d{1,2}月\d{1,2}日)/);
        if (dateMatch2) txDate = parseJapaneseDate(dateMatch2[1]);
    }
    if (!txDate) {
        txDate = message.getDate();
    }

    // ── ご利用金額 ──
    let txAmount = null;
    const amountMatch = body.match(/ご利用金額[：:\s]*[¥￥]?\s*([0-9,０-９，]+)\s*円/);
    if (amountMatch) {
        txAmount = parseAmount(amountMatch[0]);
    }
    // フォールバック: 金額パターン
    if (!txAmount) {
        const fallbackMatch = body.match(/金額[：:\s]*[¥￥]?\s*([0-9,０-９，]+)\s*円/);
        if (fallbackMatch) txAmount = parseAmount(fallbackMatch[0]);
    }

    if (!txAmount || txAmount <= 0) {
        logWarn(MODULE, '利用金額を検出できません', { subject });
        return null;
    }

    // ── ご利用先（通常版のみ） ──
    let merchant = '';
    const merchantMatch = body.match(/ご利用先[：:\s]*(.+?)[\r\n]/);
    if (merchantMatch) {
        merchant = merchantMatch[1].trim();
    } else if (isExpress) {
        merchant = '（速報版・利用先未定）';
    }

    // ── お支払い方法（通常版のみ） ──
    let paymentMethod = '';
    const payMatch = body.match(/お支払い方法[：:\s]*(.+?)[\r\n]/);
    if (payMatch) {
        paymentMethod = payMatch[1].trim();
    }

    logInfo(MODULE, '楽天カード利用抽出', {
        date: formatDate(txDate),
        amount: txAmount,
        merchant: merchant,
        isExpress: isExpress,
    });

    return {
        date: txDate,
        amount: txAmount,
        merchant: merchant,
        paymentMethod: paymentMethod,
        isExpress: isExpress,
    };
}
