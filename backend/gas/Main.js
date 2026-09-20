/**
 * ============================================================
 * MyFinance - Main Orchestrator
 * ============================================================
 * ETL パイプラインのメインエントリーポイント。
 * GAS の時間主導型トリガーから呼び出される。
 *
 * フロー:
 *   1. メール取得・解析 (Ingestion)
 *   2. 基準価額取得 (Enrichment)
 *   3. スプレッドシート書き込み (Storage)
 * ============================================================
 */

/**
 * メインETL処理。
 * 時間主導型トリガー（1時間ごと）から呼ばれる。
 */
function processNewTransactions() {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) return;
    try { processNewTransactionsLocked(); } finally { lock.releaseLock(); }
}
function processNewTransactionsLocked() {
    const MODULE = 'Main';
    const startTime = new Date();

    logInfo(MODULE, '========== ETLバッチ処理を開始 ==========');

    // ── バリデーション ──
    if (!CONFIG.spreadsheet.id) {
        logError(MODULE, 'CONFIG.spreadsheet.id が未設定です。Config.js を編集してください。', null, true);
        return;
    }

    try {
        // ── Step 1: メール取得・解析 ──
        logInfo(MODULE, '[Step 1/3] メール取得・解析');
        const parsedEmails = fetchAndParseEmails();

        if (parsedEmails.length === 0) {
            logInfo(MODULE, '処理対象の投資信託メールはありません。');
        }

        // ── Step 1.5: 銀行メール取得・解析 ──
        logInfo(MODULE, '[Step 1.5] 銀行メール取得・解析');
        const bankTransactions = fetchAndParseBankEmails();
        
        for (const tx of bankTransactions) {
            const written = writeBankRecord(tx);
            if (written) {
                tx.message.markRead();
                logInfo(MODULE, '銀行取引記録成功', { desc: tx.description, amount: tx.amount });
            } else {
                // 重複の場合も既読にする
                tx.message.markRead();
            }
        }

        // ── Step 1.7: 証券会社メール取得・解析（楽天証券・SBI証券） ──
        logInfo(MODULE, '[Step 1.7] 証券会社メール取得・解析');
        const securitiesTrades = fetchAndParseSecuritiesEmails();

        for (const trade of securitiesTrades) {
            writeSecuritiesInbox(trade);
            trade.message.markRead();
        }

        // ── Step 1.9: クレジットカードメール取得・解析（楽天カード） ──
        logInfo(MODULE, '[Step 1.9] クレジットカードメール取得・解析');
        const cardExpenses = fetchAndParseCreditCardEmails();

        for (const expense of cardExpenses) {
            const written = writeExpenseRecord(expense);
            if (written) {
                expense.message.markRead();
                logInfo(MODULE, `${expense.cardName} 利用記録成功`, {
                    merchant: expense.merchant,
                    amount: expense.amount,
                });
            } else {
                expense.message.markRead(); // 重複でも既読に
            }
        }

        if (parsedEmails.length === 0 && bankTransactions.length === 0 && securitiesTrades.length === 0 && cardExpenses.length === 0) {
            logInfo(MODULE, '新規取引データなし。終了します。');
            return;
        }

        // ── Step 2: 基準価額取得 & 口数計算 (投信のみ) ──
        logInfo(MODULE, `[Step 2/3] 基準価額取得 (${parsedEmails.length} 件)`);
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        for (const entry of parsedEmails) {
            // リクエスト間隔を空ける（礼儀正しいスクレイピング）
            if (successCount > 0 || skipCount > 0) {
                sleep(CONFIG.yahoo.requestDelay);
            }

            const nav = fetchNavPrice(entry.fundInfo.ticker, entry.tradeDate);

            if (nav === null) {
                // 基準価額が未反映 → 未読のまま残す（次回再試行）
                logWarn(MODULE, '基準価額が未取得のため、メールを未読のまま残します', {
                    fund: entry.fundKey,
                    date: formatDate(entry.tradeDate),
                });
                skipCount++;
                continue;
            }

            // 口数計算
            const quantity = calculateQuantity(entry.amount, nav);

            // ── Step 3: スプレッドシートへ書き込み ──
            const record = {
                tradeDate: entry.tradeDate,
                fundName: entry.fundInfo.displayName,
                amount: entry.amount,
                unitPrice: nav,
                quantity: quantity,
                ticker: entry.fundInfo.ticker,
            };

            const written = writeRecord(record);

            if (written) {
                // 書き込み成功 → メールを既読にする
                entry.message.markRead();
                successCount++;
                logInfo(MODULE, '取引を記録しました', {
                    fund: entry.fundKey,
                    date: formatDate(entry.tradeDate),
                    amount: entry.amount,
                    nav: nav,
                    quantity: quantity,
                });
            } else {
                // 重複等で書き込みスキップ → メールは既読にする（重複は正常系）
                entry.message.markRead();
                skipCount++;
            }
        }

        // ── サマリー ──
        const summary = {
            total: parsedEmails.length,
            success: successCount,
            skipped: skipCount,
            errors: errorCount,
            elapsedMs: elapsedMs(startTime),
        };

        logInfo(MODULE, 'バッチ処理サマリー', summary);

        if (errorCount > 0) {
            logError(MODULE, `${errorCount} 件のエラーが発生しました`, summary, true);
        }

    } catch (e) {
        logError(MODULE, 'ETLバッチ処理で致命的なエラーが発生', {
            error: e.message,
            stack: e.stack,
        }, true);
    }

    logInfo(MODULE, `========== ETLバッチ処理を完了 (${elapsedMs(startTime)}ms) ==========`);
}

/**
 * トリガーのセットアップ。
 * 初回実行時に手動で呼び出す。
 */
function setupTrigger() {
    const MODULE = 'Main';

    // 既存のトリガーを削除
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
        if (trigger.getHandlerFunction() === 'processNewTransactions') {
            ScriptApp.deleteTrigger(trigger);
            logInfo(MODULE, '既存のトリガーを削除しました');
        }
    }

    // 1時間ごとのトリガーを設定
    ScriptApp.newTrigger('processNewTransactions')
        .timeBased()
        .everyHours(1)
        .create();

    logInfo(MODULE, '時間主導型トリガーをセットアップしました (1時間間隔)');
}

/**
 * トリガーの削除。
 */
function removeTrigger() {
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
        if (trigger.getHandlerFunction() === 'processNewTransactions') {
            ScriptApp.deleteTrigger(trigger);
        }
    }
    logInfo('Main', 'トリガーを削除しました');
}

/**
 * 経過時間（ミリ秒）を計算する。
 * @param {Date} startTime
 * @returns {number}
 */
function elapsedMs(startTime) {
    return new Date().getTime() - startTime.getTime();
}

// ============================================================
// Web API (doGet) - Next.js からのデータ取得用
// ============================================================

/**
 * GAS Web App のエンドポイント。
 * Next.js Dashboard からの API リクエストを処理する。
 *
 * GET パラメータ:
 *   ?action=records    → 全取引レコード
 *   ?action=portfolio  → ポートフォリオサマリー（評価額込み）
 *   ?action=health     → ヘルスチェック
 *
 * @param {Object} e - イベントオブジェクト
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function doGet() {
    // Never expose financial records, balances or mutations through public GET.
    return jsonResponse({ status: 'error', message: 'Authenticated POST required' });
}

/** Token set ONLY in Script Properties; never commit it to Config.js. */
function doPost(e) {
    try {
        const payload = JSON.parse(e.postData.contents);
        const expected = PropertiesService.getScriptProperties().getProperty('FINANCE_API_TOKEN');
        if (!expected || expected.length < 32 || typeof payload.token !== 'string' || payload.token.length !== expected.length) {
            return jsonResponse({ status: 'error', message: 'Unauthorized' });
        }
        let diff = 0;
        for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ payload.token.charCodeAt(i);
        if (diff !== 0) return jsonResponse({ status: 'error', message: 'Unauthorized' });
        if (payload.action !== 'snapshot_v2') return jsonResponse({ status: 'error', message: 'Unsupported action' });
        return jsonResponse({ status: 'ok', data: getFinanceSnapshotV2() });
    } catch (_) {
        // Do not leak sheet identifiers, tokens, data or exception details.
        return jsonResponse({ status: 'error', message: 'Snapshot unavailable' });
    }
}
function jsonResponse(data) {
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
