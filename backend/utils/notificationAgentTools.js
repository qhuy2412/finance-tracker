/**
 * notificationAgentTools.js
 * Toolset riêng cho notification agent — tách hoàn toàn khỏi chatbot tools.
 * 3 tools: query_database, send_notification, save_weekly_report
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { validateSql, validateSqlWithExplain } = require('./sqlValidator');
const Notification = require('../model/notificationModel');
const WeeklyReport = require('../model/weeklyReportModel');

const MAX_QUERY_ROWS = 100;

// ─── Tool declarations (Google GenAI schema) ─────────────────────────────────

const toolDeclarations = [
  {
    name: 'query_database',
    description:
      'Chạy câu lệnh SQL SELECT để tra cứu dữ liệu tài chính của người dùng. ' +
      'CHỈ cho phép SELECT. Luôn lọc theo user_id. ' +
      'Khi JOIN categories: JOIN categories c ON t.category_id = c.id AND (c.user_id IS NULL OR c.user_id = \'<userId>\').',
    parameters: {
      type: 'OBJECT',
      properties: {
        sql: { type: 'STRING', description: 'Câu lệnh SQL SELECT.' },
      },
      required: ['sql'],
    },
  },
  {
    name: 'send_notification',
    description:
      'Gửi thông báo in-app đến người dùng (hiện trong bell icon). ' +
      'BẮT BUỘC gọi 1 lần mỗi cuối tuần — dù có hay không có giao dịch.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Tiêu đề ngắn gọn, có emoji. Tối đa 60 ký tự.' },
        body: {
          type: 'STRING',
          description: 'Nội dung chi tiết. Markdown được hỗ trợ. Bao gồm số liệu, insights, lời khuyên.',
        },
        type: {
          type: 'STRING',
          description:
            'Loại notification: WEEKLY_REPORT | BUDGET_ALERT | DEBT_DUE | SAVINGS_MILESTONE | ANOMALY',
        },
      },
      required: ['title', 'body', 'type'],
    },
  },
  {
    name: 'save_weekly_report',
    description:
      'Lưu dữ liệu báo cáo tuần có cấu trúc vào database để trang /reports đọc nhanh. ' +
      'BẮT BUỘC gọi 1 lần sau khi đã phân tích xong — dù tuần có hay không có giao dịch.',
    parameters: {
      type: 'OBJECT',
      properties: {
        week_start: { type: 'STRING', description: 'Ngày đầu tuần (YYYY-MM-DD, thứ Hai).' },
        totals: {
          type: 'OBJECT',
          description: '{ income: number, expense: number, net: number }',
          properties: {
            income: { type: 'NUMBER' },
            expense: { type: 'NUMBER' },
            net: { type: 'NUMBER' },
          },
          required: ['income', 'expense', 'net'],
        },
        prev_totals: {
          type: 'OBJECT',
          description: 'Tổng thu/chi tuần trước { income: number, expense: number }',
          properties: {
            income: { type: 'NUMBER' },
            expense: { type: 'NUMBER' },
          },
          required: ['income', 'expense'],
        },
        daily_breakdown: {
          type: 'ARRAY',
          description: 'Mảng 7 phần tử, mỗi phần tử là 1 ngày trong tuần (T2–CN).',
          items: {
            type: 'OBJECT',
            properties: {
              date: { type: 'STRING' },
              day_label: { type: 'STRING', description: 'T2, T3, T4, T5, T6, T7, CN' },
              income: { type: 'NUMBER' },
              expense: { type: 'NUMBER' },
            },
            required: ['date', 'day_label', 'income', 'expense'],
          },
        },
        top_categories: {
          type: 'ARRAY',
          description: 'Top danh mục chi tiêu. Tối đa 5.',
          items: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING' },
              amount: { type: 'NUMBER' },
              percentage: { type: 'NUMBER', description: '% so với tổng chi tiêu' },
            },
            required: ['name', 'amount', 'percentage'],
          },
        },
        budget_warnings: {
          type: 'ARRAY',
          description: 'Danh mục budget bị vượt hoặc gần vượt (≥80%).',
          items: {
            type: 'OBJECT',
            properties: {
              category: { type: 'STRING' },
              budget: { type: 'NUMBER' },
              spent: { type: 'NUMBER' },
              percentage: { type: 'NUMBER' },
            },
            required: ['category', 'budget', 'spent', 'percentage'],
          },
        },
        debts_due_soon: {
          type: 'ARRAY',
          description: 'Các khoản nợ đến hạn trong 7 ngày tới.',
          items: {
            type: 'OBJECT',
            properties: {
              person_name: { type: 'STRING' },
              amount: { type: 'NUMBER' },
              due_date: { type: 'STRING' },
              type: { type: 'STRING', description: 'LEND hoặc BORROW' },
            },
            required: ['person_name', 'amount', 'due_date', 'type'],
          },
        },
        savings_milestones: {
          type: 'ARRAY',
          description: 'Saving goals đạt ≥90% mục tiêu.',
          items: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING' },
              percentage: { type: 'NUMBER' },
              current_amount: { type: 'NUMBER' },
              target_amount: { type: 'NUMBER' },
            },
            required: ['name', 'percentage', 'current_amount', 'target_amount'],
          },
        },
        ai_summary: {
          type: 'STRING',
          description: 'Tóm tắt ngắn từ AI về tình hình tài chính tuần. 2-4 câu.',
        },
      },
      required: ['week_start', 'totals', 'prev_totals', 'daily_breakdown', 'top_categories',
        'budget_warnings', 'debts_due_soon', 'savings_milestones', 'ai_summary'],
    },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const capLimit = (sql) => {
  const cleanedSql = sql.trim().replace(/;+$/, '').trim();
  const rx = /\bLIMIT\s+(\d+)\b/i;
  const m = rx.exec(cleanedSql);
  if (m) {
    const n = Math.min(parseInt(m[1], 10), MAX_QUERY_ROWS);
    return cleanedSql.replace(rx, `LIMIT ${n}`);
  }
  return `${cleanedSql} LIMIT ${MAX_QUERY_ROWS}`;
};

// ─── Tool executors ──────────────────────────────────────────────────────────

const executeQueryDatabase = async ({ sql }, userId) => {
  const secCheck = validateSql(sql, userId);
  if (!secCheck.ok) return { error: `SQL bị từ chối: ${secCheck.reason}` };

  const explainResult = await validateSqlWithExplain(sql);
  if (!explainResult.ok) return { error: `Lỗi SQL: ${explainResult.error}` };

  try {
    const [rows] = await db.execute(capLimit(sql));
    if (!rows || rows.length === 0) return { result: 'Không có dữ liệu.' };

    const processed = rows.map(row => {
      const obj = {};
      for (const [k, v] of Object.entries(row)) {
        obj[k] = typeof v === 'string' && /^-?\d+\.\d+$/.test(v) ? Number(v) : v;
      }
      return obj;
    });
    return { rows: processed };
  } catch (err) {
    return { error: `Lỗi thực thi SQL: ${err.message}` };
  }
};

const executeSendNotification = async ({ title, body, type }, userId) => {
  const validTypes = ['WEEKLY_REPORT', 'BUDGET_ALERT', 'DEBT_DUE', 'SAVINGS_MILESTONE', 'ANOMALY'];
  if (!validTypes.includes(type)) {
    return { error: `type không hợp lệ: ${type}. Chỉ chấp nhận: ${validTypes.join(', ')}` };
  }
  try {
    await Notification.create(uuidv4(), userId, type, title, body);
    return { success: true };
  } catch (err) {
    return { error: `Không thể lưu notification: ${err.message}` };
  }
};

const executeSaveWeeklyReport = async (args, userId) => {
  const {
    week_start, totals, prev_totals, daily_breakdown,
    top_categories, budget_warnings, debts_due_soon,
    savings_milestones, ai_summary,
  } = args;

  const data = {
    weekStart: week_start,
    totals: {
      income: Number(totals.income || 0),
      expense: Number(totals.expense || 0),
      net: Number(totals.net || 0),
    },
    prevTotals: {
      income: Number(prev_totals.income || 0),
      expense: Number(prev_totals.expense || 0),
    },
    dailyBreakdown: (daily_breakdown || []).map(d => ({
      date: d.date,
      dayLabel: d.day_label,
      income: Number(d.income || 0),
      expense: Number(d.expense || 0),
    })),
    topCategories: (top_categories || []).map(c => ({
      name: c.name,
      amount: Number(c.amount || 0),
      percentage: Number(c.percentage || 0),
    })),
    budgetWarnings: (budget_warnings || []).map(b => ({
      category: b.category,
      budget: Number(b.budget || 0),
      spent: Number(b.spent || 0),
      percentage: Number(b.percentage || 0),
    })),
    debtsDueSoon: (debts_due_soon || []).map(d => ({
      personName: d.person_name,
      amount: Number(d.amount || 0),
      dueDate: d.due_date,
      type: d.type,
    })),
    savingsMilestones: (savings_milestones || []).map(s => ({
      name: s.name,
      percentage: Number(s.percentage || 0),
      currentAmount: Number(s.current_amount || 0),
      targetAmount: Number(s.target_amount || 0),
    })),
    aiSummary: ai_summary || '',
  };

  try {
    await WeeklyReport.upsert(uuidv4(), userId, week_start, data);
    return { success: true };
  } catch (err) {
    return { error: `Không thể lưu weekly report: ${err.message}` };
  }
};

// ─── Dispatcher ──────────────────────────────────────────────────────────────

const executeTool = async (name, args, userId) => {
  switch (name) {
    case 'query_database':
      return executeQueryDatabase(args, userId);
    case 'send_notification':
      return executeSendNotification(args, userId);
    case 'save_weekly_report':
      return executeSaveWeeklyReport(args, userId);
    default:
      return { error: `Tool "${name}" không tồn tại.` };
  }
};

module.exports = { toolDeclarations, executeTool };
