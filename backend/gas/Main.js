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
            // 既存の投信ログと同じスキーマで記録
            // （fundMapping にない銘柄は securityName + ticker で記録）
            const record = {
                tradeDate: trade.tradeDate,
                amount: Math.abs(trade.amount),
                fundKey: trade.securityName || trade.ticker,
                fundInfo: {
                    ticker: trade.ticker,
                    displayName: trade.securityName,
                },
                unitPrice: trade.price,
                quantity: trade.quantity,
                action: trade.action,
                broker: trade.broker,
            };

            // writeRecord は既存の投信ログ書き込み関数を再利用
            const written = writeRecord(record);
            if (written) {
                trade.message.markRead();
                logInfo(MODULE, `${trade.broker} 約定記録成功`, {
                    name: trade.securityName,
                    amount: trade.amount,
                });
            } else {
                trade.message.markRead(); // 重複でも既読に
            }
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
function doGet(e) {
    const MODULE = 'WebAPI';
    const action = e.parameter.action || 'health';

    try {
        let responseData;

        switch (action) {
            case 'records':
                logInfo(MODULE, 'Records API リクエスト');
                responseData = {
                    status: 'ok',
                    data: getAllRecords(),
                    timestamp: new Date().toISOString(),
                };
                break;

            case 'portfolio':
                logInfo(MODULE, 'Portfolio API リクエスト');
                responseData = {
                    status: 'ok',
                    data: getPortfolioSummary(),
                    timestamp: new Date().toISOString(),
                };
                break;
                
            case 'bank':
                logInfo(MODULE, 'Bank Balance API リクエスト');
                responseData = {
                    status: 'ok',
                    data: getBankBalance(),
                    timestamp: new Date().toISOString()
                };
                break;

            case 'health':
            default:
                responseData = {
                    status: 'ok',
                    message: 'MyFinance GAS Backend is running',
                    version: '1.1.0',
                    timestamp: new Date().toISOString(),
                };
                break;
        }

        return ContentService
            .createTextOutput(JSON.stringify(responseData))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (e) {
        logError(MODULE, 'API エラー', { error: e.message }, true);

        return ContentService
            .createTextOutput(JSON.stringify({
                status: 'error',
                message: e.message,
                timestamp: new Date().toISOString(),
            }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

/**
 * 残高調整用API (POST)
 * Payload: { action: 'adjust_balance', amount: 123456 }
 */
function doPost(e) {
    const MODULE = 'WebAPI(POST)';
    try {
        const payload = JSON.parse(e.postData.contents);
        
        if (payload.action === 'adjust_balance') {
            const current = getBankBalance();
            const targetBalance = Number(payload.amount);
            const diff = targetBalance - current.balance;
            
            if (diff === 0) {
                return jsonResponse({ status: 'ok', message: 'No adjustment needed' });
            }
            
            // 調整レコードを追加
            const record = {
                date: new Date(),
                description: '残高調整（手動）',
                amount: diff
            };
            
            writeBankRecord(record);
            
            return jsonResponse({ 
                status: 'ok', 
                message: 'Balance adjusted', 
                adjustment: diff,
                newBalance: targetBalance
            });
        }
        
        return jsonResponse({ status: 'error', message: 'Invalid action' });
        
    } catch (error) {
         logError(MODULE, 'POST Error', { error: error.message });
         return jsonResponse({ status: 'error', message: error.message });
    }
}

function jsonResponse(data) {
    return ContentService
        .createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}
