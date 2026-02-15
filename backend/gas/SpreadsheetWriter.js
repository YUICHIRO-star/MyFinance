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
 * 銀行ログ用のシートを取得または作成する。
 * シートが存在しない場合はヘッダーと計算式を設定して新規作成する。
 * 
 * 構造:
 * Row 1: Headers
 * Row 2: Initial Balance (User manually sets this)
 * Row 3+: Transactions
 * Column E (Balance): Formula using SCAN
 *
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateBankSheet() {
    const MODULE = 'SpreadsheetWriter';
    const ss = SpreadsheetApp.openById(CONFIG.spreadsheet.id);
    let sheet = ss.getSheetByName(CONFIG.bank.sheetName);

    if (!sheet) {
        logInfo(MODULE, '銀行ログシートが存在しないため新規作成', { name: CONFIG.bank.sheetName });
        sheet = ss.insertSheet(CONFIG.bank.sheetName);

        // ヘッダー行 (Row 1)
        const headers = ['date', 'description', 'deposit', 'withdrawal', 'balance', 'category'];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

        // スタイル設定
        const headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setBackground('#34a853'); // Green for money
        headerRange.setFontColor('#ffffff');
        headerRange.setFontWeight('bold');

        // 初期残高行 (Row 2) - ユーザーが手動で合わせるための行
        // A2: 日付, B2: "初期残高", E2: 初期値
        sheet.getRange(2, 1).setValue(new Date());
        sheet.getRange(2, 2).setValue('初期残高');
        sheet.getRange(2, 5).setValue(CONFIG.bank.initialBalance || 0);
        
        // 残高計算式 (E3以降)
        // SCAN関数を使用して、E2を初期値としてC列(入金)-D列(出金)を累積する
        // IF文で空行は計算しないようにする
        // =SCAN(E2, C3:C, LAMBDA(bal, dep, bal + dep - OFFSET(dep, 0, 1))) 
        // 簡略化: 入金(C) - 出金(D)
        
        // 注意: SCANは配列を返すため、E3セルに1つ入れるだけで下方向に展開される
        const formula = '=SCAN(E2, C3:C, LAMBDA(bal, dep, IF(AND(dep="", OFFSET(dep, 0, 1)=""), "", bal + N(dep) - N(OFFSET(dep, 0, 1)))))';
        sheet.getRange('E3').setFormula(formula);

        // 列幅設定
        sheet.setColumnWidth(1, 120); // date
        sheet.setColumnWidth(2, 300); // description
        sheet.setColumnWidth(3, 100); // deposit
        sheet.setColumnWidth(4, 100); // withdrawal
        sheet.setColumnWidth(5, 120); // balance
        sheet.setColumnWidth(6, 100); // category (optional)

        // ウィンドウ枠の固定
        sheet.setFrozenRows(2); // ヘッダー + 初期残高

        logInfo(MODULE, '銀行ログシートを初期化しました');
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
 * 銀行取引データを書き込む。
 * 重複チェック済みであることを前提とする（または呼び出し元でチェック）。
 *
 * @param {Object} record
 * @param {Date}   record.date        - 取引日
 * @param {string} record.description - 摘要
 * @param {number} record.amount      - 金額 (正: 入金, 負: 出金)
 * @returns {boolean}
 */
function writeBankRecord(record) {
    const MODULE = 'SpreadsheetWriter';

    try {
        const sheet = getOrCreateBankSheet();

        // 重複チェック
        if (isBankDuplicate(sheet, record)) {
            logWarn(MODULE, '銀行取引重複のためスキップ', {
                date: formatDate(record.date),
                desc: record.description,
                amount: record.amount
            });
            return false;
        }

        // 入金・出金の振り分け
        const deposit = record.amount > 0 ? record.amount : '';
        const withdrawal = record.amount < 0 ? Math.abs(record.amount) : '';

        // 行を追加 (SCAN関数がE列にあるため、A-D, F列あたりに値を入れるか、appendRowでうまくいくか確認)
        // appendRowは「データがある最終行の次」に追加する。
        // SCAN関数がE3に入っていると、E列はずっとデータがあるとみなされる可能性がある（Spill機能）。
        // そのため、getLastRow() の挙動に注意が必要。
        // SCANの結果がSpillしている場合、getLastRowはシートの最終行近くになる可能性がある。
        // 安全のため、A列(日付)の最終行を探して追加するロジックにする。

        const lastRowA = getLastRowInColumn(sheet, 1); // 1 = Column A
        const targetRow = lastRowA + 1;

        sheet.getRange(targetRow, 1).setValue(record.date);
        sheet.getRange(targetRow, 2).setValue(record.description);
        sheet.getRange(targetRow, 3).setValue(deposit);
        sheet.getRange(targetRow, 4).setValue(withdrawal);
        // E列は数式で自動計算されるので触らない
        
        // 書式設定
        sheet.getRange(targetRow, 1).setNumberFormat('yyyy/mm/dd');
        sheet.getRange(targetRow, 3).setNumberFormat('#,##0');
        sheet.getRange(targetRow, 4).setNumberFormat('#,##0');
        sheet.getRange(targetRow, 5).setNumberFormat('#,##0');

        logInfo(MODULE, '銀行取引を記録しました', {
            date: formatDate(record.date),
            desc: record.description,
            amount: record.amount
        });

        return true;

    } catch (e) {
        logError(MODULE, '銀行ログ書き込みエラー', { error: e.message }, true);
        return false;
    }
}

/**
 * 特定の列におけるデータが存在する最終行を取得する
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet 
 * @param {number} column 1-indexed column number
 */
function getLastRowInColumn(sheet, column) {
    const lastRow = sheet.getLastRow();
    if (lastRow === 0) return 0;
    
    // データ範囲を取得して逆順に探索
    // (大量データの場合は効率が悪いが、個人利用なら許容範囲)
    const values = sheet.getRange(1, column, lastRow, 1).getValues();
    
    for (let i = values.length - 1; i >= 0; i--) {
        if (values[i][0] !== "" && values[i][0] !== null) {
            return i + 1;
        }
    }
    return 0;
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
 * 銀行取引の重複チェック
 */
function isBankDuplicate(sheet, record) {
    // 簡易的な重複チェック: 日付、摘要、金額が一致するか
    // 直近50件くらいを見れば十分
    const lastRowA = getLastRowInColumn(sheet, 1);
    if (lastRowA <= 2) return false;

    const startRow = Math.max(3, lastRowA - 50);
    const numRows = lastRowA - startRow + 1;
    
    const data = sheet.getRange(startRow, 1, numRows, 4).getValues(); // A:Date, B:Desc, C:Dep, D:With
    const targetDate = formatDate(record.date);
    const targetDeposit = record.amount > 0 ? record.amount : '';
    const targetWithdrawal = record.amount < 0 ? Math.abs(record.amount) : '';

    for (const row of data) {
        const existingDate = row[0] instanceof Date ? formatDate(row[0]) : String(row[0]);
        const existingDesc = String(row[1]);
        const existingDeposit = row[2] === "" ? "" : Number(row[2]);
        const existingWithdrawal = row[3] === "" ? "" : Number(row[3]);

        if (existingDate === targetDate &&
            existingDesc === record.description &&
            existingDeposit === targetDeposit &&
            existingWithdrawal === targetWithdrawal) {
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

// ============================================================
// 支出ログ (クレジットカード)
// ============================================================

/**
 * 支出ログシートを取得または作成する。
 *
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateExpenseSheet() {
    const MODULE = 'ExpenseWriter';
    const ss = SpreadsheetApp.openById(CONFIG.spreadsheet.id);
    let sheet = ss.getSheetByName(CONFIG.expense.sheetName);

    if (!sheet) {
        logInfo(MODULE, `「${CONFIG.expense.sheetName}」シートを作成`);
        sheet = ss.insertSheet(CONFIG.expense.sheetName);

        // ヘッダー行を設定
        const headers = ['日付', '金額', '利用先', 'カード', '支払方法', '速報', '記録日時'];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

        // ヘッダー行を固定
        sheet.setFrozenRows(1);

        // 書式設定
        sheet.getRange(1, 1, 1, headers.length)
            .setFontWeight('bold')
            .setBackground('#4285f4')
            .setFontColor('#ffffff');
    }

    return sheet;
}

/**
 * クレジットカード利用データをスプレッドシートに書き込む。
 * 重複チェック（日付 + 金額 + 利用先の一致）を行う。
 *
 * @param {Object} expense - { date, amount, merchant, cardName, paymentMethod, isExpress }
 * @returns {boolean} 書き込み成功/重複スキップ
 */
function writeExpenseRecord(expense) {
    const MODULE = 'ExpenseWriter';
    const sheet = getOrCreateExpenseSheet();
    const dateStr = formatDate(expense.date);

    // 重複チェック
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
        const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
        for (const row of data) {
            const existingDate = row[0] instanceof Date ? formatDate(row[0]) : String(row[0]);
            const existingAmount = Number(row[1]);
            const existingMerchant = String(row[2]);

            if (existingDate === dateStr &&
                existingAmount === expense.amount &&
                existingMerchant === expense.merchant) {
                logInfo(MODULE, '重複レコードをスキップ', {
                    date: dateStr,
                    amount: expense.amount,
                    merchant: expense.merchant,
                });
                return false;
            }
        }
    }

    // 新しい行に書き込み
    sheet.appendRow([
        dateStr,
        expense.amount,
        expense.merchant,
        expense.cardName,
        expense.paymentMethod,
        expense.isExpress ? '速報' : '',
        new Date(),
    ]);

    logInfo(MODULE, '支出レコード記録', {
        date: dateStr,
        amount: expense.amount,
        merchant: expense.merchant,
    });

    return true;
}
