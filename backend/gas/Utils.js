/**
 * ============================================================
 * MyFinance - Utility Functions
 * ============================================================
 * 共通ユーティリティ関数群。
 * 日付処理・文字列処理・ロギングなどの横断的関心事を集約。
 * ============================================================
 */

/**
 * 日本語日付文字列を Date オブジェクトに変換する。
 * 対応フォーマット:
 *   - 2024/01/15, 2024-01-15
 *   - 2024年1月15日, 2024年01月15日
 *
 * @param {string} dateStr - 日付を含む文字列
 * @returns {Date|null} パース結果。失敗時は null
 */
function parseJapaneseDate(dateStr) {
    if (!dateStr) return null;

    // パターン1: YYYY/MM/DD or YYYY-MM-DD
    const slashPattern = /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/;
    // パターン2: YYYY年M月D日
    const kanjiPattern = /(\d{4})年(\d{1,2})月(\d{1,2})日?/;

    let match = dateStr.match(slashPattern) || dateStr.match(kanjiPattern);
    if (!match) return null;

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // 0-indexed
    const day = parseInt(match[3], 10);

    const date = new Date(year, month, day);

    // 有効な日付かどうかバリデーション
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
        return null;
    }

    return date;
}

/**
 * 金額文字列から数値を抽出する。
 * "12,345円" → 12345, "¥1,000" → 1000
 *
 * @param {string} amountStr - 金額を含む文字列
 * @returns {number|null} 金額（整数）。抽出失敗時は null
 */
function parseAmount(amountStr) {
    if (!amountStr) return null;

    // 全角数字を半角に変換
    const normalized = amountStr.replace(/[０-９]/g, (ch) =>
        String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
    );

    // カンマ区切り数値を抽出（円記号・¥記号の前後対応）
    const match = normalized.match(/[¥￥]?\s*([0-9,]+)\s*円?/);
    if (!match) return null;

    const cleaned = match[1].replace(/,/g, '');
    const value = parseInt(cleaned, 10);

    return isNaN(value) ? null : value;
}

/**
 * Date → "YYYY/MM/DD" フォーマット文字列
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
}

/**
 * Date → "YYYYMMDD" フォーマット文字列（URL構築用）
 * @param {Date} date
 * @returns {string}
 */
function formatDateCompact(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
}

/**
 * ミリ秒のスリープ（GASの Utilities.sleep ラッパー）
 * @param {number} ms
 */
function sleep(ms) {
    Utilities.sleep(ms);
}

/**
 * 構造化ログ出力（INFO レベル）
 * @param {string} module - モジュール名
 * @param {string} message - メッセージ
 * @param {Object} [data] - 追加データ
 */
function logInfo(module, message, data) {
    const entry = {
        level: 'INFO',
        timestamp: new Date().toISOString(),
        module: module,
        message: message,
    };
    if (data) entry.data = data;
    console.log(JSON.stringify(entry));
}

/**
 * 構造化ログ出力（WARN レベル）
 * @param {string} module
 * @param {string} message
 * @param {Object} [data]
 */
function logWarn(module, message, data) {
    const entry = {
        level: 'WARN',
        timestamp: new Date().toISOString(),
        module: module,
        message: message,
    };
    if (data) entry.data = data;
    console.warn(JSON.stringify(entry));
}

/**
 * 構造化ログ出力（ERROR レベル）+ オプションでメール通知
 * @param {string} module
 * @param {string} message
 * @param {Object} [data]
 * @param {boolean} [notify=false] 管理者へ通知するか
 */
function logError(module, message, data, notify) {
    const entry = {
        level: 'ERROR',
        timestamp: new Date().toISOString(),
        module: module,
        message: message,
    };
    if (data) entry.data = data;
    console.error(JSON.stringify(entry));

    // メール通知
    if (notify && CONFIG.notification.adminEmail) {
        try {
            MailApp.sendEmail({
                to: CONFIG.notification.adminEmail,
                subject: `${CONFIG.notification.subjectPrefix} ${module}: ${message}`,
                body: JSON.stringify(entry, null, 2),
            });
        } catch (e) {
            console.error('Failed to send notification email: ' + e.message);
        }
    }
}
