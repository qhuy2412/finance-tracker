const db = require('../config/db');
const { ALLOWED_TABLES } = require('./promptsV2');

/**
 * Kiểm tra tĩnh câu SQL trước khi thực thi:
 * - Phải là SELECT
 * - Không chứa từ khoá DML/DDL nguy hiểm
 * - Chỉ dùng các bảng trong ALLOWED_TABLES
 * - Bắt buộc có điều kiện user_id = 'uuid' để đảm bảo ownership
 */
const validateSql = (sql, userId) => {
    if (!sql || typeof sql !== 'string') return { ok: false, reason: 'SQL rỗng' };
    const trimmed = sql.trim();

    if (!/^\s*SELECT\b/i.test(trimmed)) return { ok: false, reason: 'Chỉ cho phép lệnh SELECT' };

    const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|REPLACE|EXEC|EXECUTE|GRANT|REVOKE|SHOW|CALL|LOAD|OUTFILE)\b/i;
    if (forbidden.test(trimmed)) return { ok: false, reason: 'Phát hiện từ khoá SQL bị cấm' };

    if (/\bSELECT\b.+\bINTO\b/is.test(trimmed)) return { ok: false, reason: 'SELECT INTO bị cấm' };

    const tableRx = /\b(?:FROM|JOIN)\s+[`"]?(\w+)[`"]?/gi;
    let match;
    while ((match = tableRx.exec(trimmed)) !== null) {
        const tbl = match[1].toLowerCase();
        if (!ALLOWED_TABLES.has(tbl)) return { ok: false, reason: `Bảng không được phép truy cập: ${tbl}` };
    }

    const escapedId = userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const userIdRx = new RegExp(`(?:\\w+\\.)?user_id\\s*=\\s*'${escapedId}'`, 'i');
    if (!userIdRx.test(trimmed)) {
        return { ok: false, reason: "Bảo mật: SQL thiếu điều kiện lọc [alias.]user_id = 'uuid'." };
    }

    return { ok: true };
};

/**
 * Chạy EXPLAIN để MySQL bắt lỗi syntax cơ bản (sai tên cột, sai JOIN...).
 * Lưu ý: EXPLAIN KHÔNG bắt được ONLY_FULL_GROUP_BY — lỗi đó chỉ lộ khi chạy thật.
 */
const validateSqlWithExplain = async (sql) => {
    try {
        await db.execute(`EXPLAIN ${sql}`);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message || String(e) };
    }
};

module.exports = { validateSql, validateSqlWithExplain };
