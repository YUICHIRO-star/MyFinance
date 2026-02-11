/**
 * ============================================================
 * MyFinance - Spreadsheet Writer (Storage Layer)
 * ============================================================
 * Google Spreadsheet に取引データを書き込む。
 * 重複チェック・スキーマバリデーションを実装。
 * ============================================================
 */

/**
 * スプレッドシートのシートオブジェクトを取得する。
 * シートが存在しない場合はヘッダー付きで新規作成する。
 *
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateSheet() {
    const MODULE = 'SpreadsheetWriter';
    const ss = SpreadsheetApp.openById(CONFIG.spreadsheet.id);
    let sheet = ss.getSheetByName(CONFIG.spreadsheet.sheetName);

    if (!sheet) {
        logInfo(MODULE, 'シートが存在しないため新規作成', { name: CONFIG.spreadsheet.sheetName });
        sheet = ss.insertSheet(CONFIG.spreadsheet.sheetName);

        // ヘッダー行を設定
        const headers = ['date', 'fund_name', 'amount', 'unit_price', 'quantity', 'ticker'];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

        // ヘッダー行のスタイリング
        const headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setBackground('#4285f4');
        headerRange.setFontColor('#ffffff');
        headerRange.setFontWeight('bold');

        // 列幅の設定
        sheet.setColumnWidth(1, 120);  // date
        sheet.setColumnWidth(2, 300);  // fund_name
        sheet.setColumnWidth(3, 120);  // amount
        sheet.setColumnWidth(4, 120);  // unit_price
        sheet.setColumnWidth(5, 120);  // quantity
        sheet.setColumnWidth(6, 120);  // ticker

        // 1行目を固定
        sheet.setFrozenRows(1);

        logInfo(MODULE, 'シートを初期化しました');
    }

    return sheet;
}

/**
 * 取引データをスプレッドシートに書き込む。
 * 重複レコードのチェックを行い、同一日・同一銘柄・同一金額のデータは挿入しない。
 *
 * @param {Object} record - 取引レコード
 * @param {Date}    record.tradeDate - 約定日
 * @param {string}  record.fundName  - 銘柄名
 * @param {number}  record.amount    - 投資金額
 * @param {number}  record.unitPrice - 基準価額
 * @param {number}  record.quantity  - 口数
 * @param {string}  record.ticker    - ティッカーコード
 * @returns {boolean} 書き込み成功時 true
 */
function writeRecord(record) {
    const MODULE = 'SpreadsheetWriter';

    try {
        const sheet = getOrCreateSheet();

        // ── 重複チェック ──
        if (isDuplicate(sheet, record)) {
            logWarn(MODULE, '重複データのためスキップ', {
                date: formatDate(record.tradeDate),
                fund: record.fundName,
                amount: record.amount,
            });
            return false;
        }

        // ── データの書き込み ──
        const newRow = [
            formatDate(record.tradeDate),
            record.fundName,
            record.amount,
            record.unitPrice,
            record.quantity,
            record.ticker,
        ];

        sheet.appendRow(newRow);

        // 日付列のフォーマット設定
        const lastRow = sheet.getLastRow();
        sheet.getRange(lastRow, 1).setNumberFormat('yyyy/mm/dd');
        // 金額・数量のフォーマット
        sheet.getRange(lastRow, 3).setNumberFormat('#,##0');
        sheet.getRange(lastRow, 4).setNumberFormat('#,##0');
        sheet.getRange(lastRow, 5).setNumberFormat('#,##0');

        logInfo(MODULE, 'レコードを書き込みました', {
            date: formatDate(record.tradeDate),
            fund: record.fundName,
            amount: record.amount,
            nav: record.unitPrice,
            quantity: record.quantity,
        });

        return true;

    } catch (e) {
        logError(MODULE, 'スプレッドシート書き込みエラー', {
            error: e.message,
            stack: e.stack,
        }, true);
        return false;
    }
}

/**
 * 重複レコードをチェックする。
 * 同一日・同一銘柄・同一金額の組み合わせを重複とみなす。
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} record
 * @returns {boolean} 重複していれば true
 */
function isDuplicate(sheet, record) {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return false; // ヘッダーのみ

    const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    const targetDate = formatDate(record.tradeDate);

    for (const row of data) {
        const existingDate = row[0] instanceof Date ? formatDate(row[0]) : String(row[0]);
        const existingFund = String(row[1]);
        const existingAmount = Number(row[2]);

        if (existingDate === targetDate &&
            existingFund === record.fundName &&
            existingAmount === record.amount) {
            return true;
        }
    }

    return false;
}

/**
 * スプレッドシートから全レコードを取得する。
 * Next.js 側のデータ連携用API として使用可能。
 *
 * @returns {Array<Object>} レコードの配列
 */
function getAllRecords() {
    const sheet = getOrCreateSheet();
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) return [];

    const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();

    return data.map((row) => ({
        date: row[0] instanceof Date ? formatDate(row[0]) : String(row[0]),
        fundName: String(row[1]),
        amount: Number(row[2]),
        unitPrice: Number(row[3]),
        quantity: Number(row[4]),
        ticker: String(row[5]),
    }));
}

/**
 * 最新の基準価額を取得し、各銘柄の評価額を計算する。
 * (ダッシュボード用：Web API として利用可能)
 *
 * @returns {Array<Object>} 銘柄ごとの評価データ
 */
function getPortfolioSummary() {
    const MODULE = 'SpreadsheetWriter';
    const records = getAllRecords();

    if (records.length === 0) return [];

    // 銘柄ごとに集計
    const fundMap = {};
    for (const record of records) {
        const key = record.ticker;
        if (!fundMap[key]) {
            fundMap[key] = {
                fundName: record.fundName,
                ticker: key,
                totalAmount: 0,
                totalQuantity: 0,
                records: [],
            };
        }
        fundMap[key].totalAmount += record.amount;
        fundMap[key].totalQuantity += record.quantity;
        fundMap[key].records.push(record);
    }

    // 各銘柄の最新基準価額を取得して評価額を算出
    const portfolio = [];
    for (const key of Object.keys(fundMap)) {
        const fund = fundMap[key];

        // 最新の基準価額を取得（今日から直近の営業日）
        const today = new Date();
        const latestNav = fetchNavPrice(fund.ticker, today);

        const currentValue = latestNav
            ? Math.round((fund.totalQuantity / 10000) * latestNav)
            : null;

        portfolio.push({
            fundName: fund.fundName,
            ticker: fund.ticker,
            totalInvested: fund.totalAmount,
            totalQuantity: fund.totalQuantity,
            latestNav: latestNav,
            currentValue: currentValue,
            profitLoss: currentValue ? currentValue - fund.totalAmount : null,
            profitLossRate: currentValue
                ? ((currentValue - fund.totalAmount) / fund.totalAmount * 100).toFixed(2)
                : null,
            recordCount: fund.records.length,
        });
    }

    return portfolio;
}
