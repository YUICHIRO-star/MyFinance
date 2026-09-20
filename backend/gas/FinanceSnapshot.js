/** V2 read model. No fabricated valuations or zero fallback for missing data.
 * Optional sheets use the CSV headers documented in docs/DATA_CONTRACT.md.
 * Accounts: broker balance means CASH ONLY, never total brokerage assets.
 */
function readFinanceRows(ss, name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet || sheet.getLastRow() < 2) return [];
    const values = sheet.getDataRange().getValues();
    const headers = values.shift().map(String);
    return values.filter(row => row.some(x => x !== '')).map(row => {
        const result = {};
        headers.forEach((key, i) => { result[key] = row[i]; });
        return result;
    });
}
function financeTime(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new Error('Invalid timestamp');
    return date.toISOString();
}
function financeDate(value) {
    if (value instanceof Date) return Utilities.formatDate(value, 'Asia/Tokyo', 'yyyy-MM-dd');
    return String(value).replace(/\//g, '-');
}
function financeAmount(value) {
    if (value === '' || value === undefined || value === null) return null;
    const n = Number(value);
    if (!Number.isSafeInteger(n)) throw new Error('Invalid integer yen');
    return n;
}
function getFinanceSnapshotV2() {
    const ss = SpreadsheetApp.openById(CONFIG.spreadsheet.id);
    const warnings = [];
    const accounts = readFinanceRows(ss, 'FinanceAccounts').map(r => ({
        id: String(r.id), name: String(r.name), kind: String(r.kind), balance: financeAmount(r.balance),
        asOf: financeTime(r.asOf), source: 'manual', estimated: r.estimated === true || String(r.estimated) === 'true'
    }));
    const holdings = readFinanceRows(ss, 'FinanceHoldings').map(r => ({
        id: String(r.id), accountId: String(r.accountId), name: String(r.name), ticker: String(r.ticker),
        wrapper: String(r.wrapper), cost: financeAmount(r.cost), value: financeAmount(r.value), asOf: financeTime(r.asOf)
    }));
    const entries = readFinanceRows(ss, 'FinanceEntries').map(r => ({
        id: String(r.id), accountId: String(r.accountId), date: financeDate(r.date), merchant: String(r.merchant),
        amount: financeAmount(r.amount), kind: String(r.kind), status: String(r.status), category: String(r.category), source: 'manual',
        ...(r.replaces ? { replaces: String(r.replaces) } : {})
    }));
    const expenseSheet = ss.getSheetByName(CONFIG.expense.sheetName);
    if (expenseSheet && expenseSheet.getLastRow() > 1) {
        const rows = expenseSheet.getRange(2, 1, expenseSheet.getLastRow() - 1, 9).getValues();
        rows.forEach((r, i) => {
            if (!r[0]) return;
            const accountId = 'card-' + String(r[3]);
            if (!accounts.some(a => a.id === accountId)) accounts.push({ id: accountId, name: String(r[3]) + ' カード', kind: 'card', balance: null, asOf: null, source: 'email', estimated: true });
            entries.push({ id: r[7] ? 'mail-' + String(r[7]) : 'legacy-expense-' + (i + 2), accountId,
                date: financeDate(r[0]), merchant: String(r[2]) || '利用先未確認', amount: financeAmount(r[1]),
                kind: 'expense', status: r[5] ? 'pending' : 'posted', category: '未分類', source: 'email',
                ...(r[8] ? { replaces: 'mail-' + String(r[8]) } : {}) });
        });
        warnings.push('メール由来の速報と通常通知は自動照合しません。同じ利用を両方取り込んだ場合は支出が重複するため、支出ログのreplaces_id列に元の速報source_idを指定してください。');
    }
    if (!accounts.length) warnings.push('確認済みの残高がありません。FinanceAccountsに残高・確認日時を登録してください。');
    const legacy = ss.getSheetByName(CONFIG.spreadsheet.sheetName);
    if (legacy && legacy.getLastRow() > 1) warnings.push('旧投信ログは売買区分・株式単位の欠落があり、現在保有額に自動変換していません。証券会社の保有残高でFinanceHoldingsを確認してください。');
    warnings.push('銀行メールからの残高推定は確定残高として使用していません。残高はFinanceAccountsの確認時点です。');
    return { version: 2, mode: 'live', asOf: new Date().toISOString(), accounts, holdings, entries,
        history: readFinanceRows(ss, 'FinanceHistory').map(r => ({ date: financeDate(r.date), value: financeAmount(r.value) })), warnings };
}
/** Store securities mail without destroying sell side or mixing stock/share units with funds. */
function writeSecuritiesInbox(trade) {
    const ss = SpreadsheetApp.openById(CONFIG.spreadsheet.id);
    let sheet = ss.getSheetByName('SecuritiesInbox');
    if (!sheet) {
        sheet = ss.insertSheet('SecuritiesInbox');
        sheet.appendRow(['message_id', 'date', 'broker', 'side', 'name', 'ticker', 'quantity', 'price', 'amount', 'review_status']);
    }
    const id = trade.message.getId();
    if (sheet.getLastRow() > 1 && sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().some(r => String(r[0]) === id)) return false;
    sheet.appendRow([id, trade.tradeDate, trade.broker, trade.action, trade.securityName, trade.ticker, trade.quantity, trade.price, trade.amount, '要確認・保有残高未反映']);
    return true;
}
