const db = require('../config/db');
const WeeklyReport = require('../model/weeklyReportModel');

// ─── In-memory cache for current-week live data (5 min TTL) ──────────────────
// Key: userId, Value: { data, expiredAt }
const liveReportCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (d) => d.toISOString().slice(0, 10);

/**
 * Get Monday and Sunday of the week that is `offset` weeks ago.
 * offset=0 → current week, offset=1 → last week.
 */
const getWeekRange = (offset = 0) => {
  const now = new Date();
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1 - offset * 7);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);
  const prevSunday = new Date(monday);
  prevSunday.setDate(monday.getDate() - 1);

  return {
    weekStart: fmt(monday),
    weekEnd: fmt(sunday),
    prevWeekStart: fmt(prevMonday),
    prevWeekEnd: fmt(prevSunday),
    today: fmt(now),
  };
};

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/**
 * Build a live report by querying the DB directly.
 * Used for the current partial week when no pre-computed data exists.
 */
const computeLiveReport = async (userId, offset = 0) => {
  const { weekStart, weekEnd, prevWeekStart, prevWeekEnd } = getWeekRange(offset);

  const [
    [[totalsRow]],
    [[prevTotalsRow]],
    [dailyRows],
    [categoryRows],
    [budgetRows],
    [debtRows],
    [savingRows],
  ] = await Promise.all([
    // This week totals
    db.execute(
      `SELECT
         COALESCE(SUM(CASE WHEN type='INCOME' THEN amount ELSE 0 END), 0) AS income,
         COALESCE(SUM(CASE WHEN type='EXPENSE' THEN amount ELSE 0 END), 0) AS expense
       FROM transactions
       WHERE user_id = ? AND transaction_date BETWEEN ? AND ?`,
      [userId, weekStart, weekEnd]
    ),
    // Prev week totals
    db.execute(
      `SELECT
         COALESCE(SUM(CASE WHEN type='INCOME' THEN amount ELSE 0 END), 0) AS income,
         COALESCE(SUM(CASE WHEN type='EXPENSE' THEN amount ELSE 0 END), 0) AS expense
       FROM transactions
       WHERE user_id = ? AND transaction_date BETWEEN ? AND ?`,
      [userId, prevWeekStart, prevWeekEnd]
    ),
    // Daily breakdown
    db.execute(
      `SELECT
         transaction_date AS date,
         COALESCE(SUM(CASE WHEN type='INCOME' THEN amount ELSE 0 END), 0) AS income,
         COALESCE(SUM(CASE WHEN type='EXPENSE' THEN amount ELSE 0 END), 0) AS expense
       FROM transactions
       WHERE user_id = ? AND transaction_date BETWEEN ? AND ?
       GROUP BY transaction_date
       ORDER BY transaction_date`,
      [userId, weekStart, weekEnd]
    ),
    // Top 5 expense categories
    db.execute(
      `SELECT c.name, SUM(t.amount) AS amount
       FROM transactions t
       JOIN categories c ON t.category_id = c.id AND (c.user_id IS NULL OR c.user_id = ?)
       WHERE t.user_id = ? AND t.type = 'EXPENSE' AND t.transaction_date BETWEEN ? AND ?
       GROUP BY c.name
       ORDER BY amount DESC
       LIMIT 5`,
      [userId, userId, weekStart, weekEnd]
    ),
    // Budget warnings (≥80%)
    db.execute(
      `SELECT c.name AS category, b.amount AS budget,
              COALESCE(SUM(t.amount), 0) AS spent
       FROM budgets b
       JOIN categories c ON b.category_id = c.id
       LEFT JOIN transactions t
         ON b.category_id = t.category_id
         AND t.user_id = b.user_id
         AND t.type = 'EXPENSE'
         AND MONTH(t.transaction_date) = MONTH(CURRENT_DATE)
         AND YEAR(t.transaction_date) = YEAR(CURRENT_DATE)
       WHERE b.user_id = ? AND b.period = DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
       GROUP BY b.id, c.name, b.amount
       HAVING (spent / b.amount) >= 0.8`,
      [userId]
    ),
    // Debts due in 7 days
    db.execute(
      `SELECT person_name, amount, due_date, type
       FROM debts
       WHERE user_id = ? AND status = 'UNPAID'
         AND due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
       ORDER BY due_date`,
      [userId]
    ),
    // Saving goals ≥90%
    db.execute(
      `SELECT name, target_amount, current_amount
       FROM saving_goals
       WHERE user_id = ? AND status != 'COMPLETED'
         AND current_amount / target_amount >= 0.9`,
      [userId]
    ),
  ]);

  const income = Number(totalsRow.income || 0);
  const expense = Number(totalsRow.expense || 0);
  const totalExpense = expense || 1; // Avoid division by zero

  // Build full 7-day array (fill missing days with 0)
  const dailyMap = {};
  for (const row of dailyRows) {
    const d = row.date instanceof Date ? fmt(row.date) : String(row.date).slice(0, 10);
    dailyMap[d] = { income: Number(row.income), expense: Number(row.expense) };
  }

  const startDate = new Date(weekStart);
  const dailyBreakdown = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const key = fmt(d);
    return {
      date: key,
      dayLabel: DAY_LABELS[d.getDay()],
      income: dailyMap[key]?.income ?? 0,
      expense: dailyMap[key]?.expense ?? 0,
    };
  });

  const topCategories = categoryRows.map(c => ({
    name: c.name,
    amount: Number(c.amount),
    percentage: Math.round((Number(c.amount) / totalExpense) * 100),
  }));

  const budgetWarnings = budgetRows.map(b => ({
    category: b.category,
    budget: Number(b.budget),
    spent: Number(b.spent),
    percentage: Math.round((Number(b.spent) / Number(b.budget)) * 100),
  }));

  const debtsDueSoon = debtRows.map(d => ({
    personName: d.person_name,
    amount: Number(d.amount),
    dueDate: d.due_date instanceof Date ? fmt(d.due_date) : String(d.due_date).slice(0, 10),
    type: d.type,
  }));

  const savingsMilestones = savingRows.map(s => ({
    name: s.name,
    currentAmount: Number(s.current_amount),
    targetAmount: Number(s.target_amount),
    percentage: Math.round((Number(s.current_amount) / Number(s.target_amount)) * 100),
  }));

  return {
    weekStart,
    weekEnd,
    isLive: true,
    totals: { income, expense, net: income - expense },
    prevTotals: {
      income: Number(prevTotalsRow.income || 0),
      expense: Number(prevTotalsRow.expense || 0),
    },
    dailyBreakdown,
    topCategories,
    budgetWarnings,
    debtsDueSoon,
    savingsMilestones,
    aiSummary: null, // Live data has no AI summary yet
  };
};

// ─── Controller ──────────────────────────────────────────────────────────────

/**
 * GET /api/reports/weekly?offset=0
 * offset=0 → current week (live or pre-computed)
 * offset=1 → last week (pre-computed)
 * offset=2 → 2 weeks ago (pre-computed), etc.
 */
const getWeeklyReport = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const offset = Math.max(0, parseInt(req.query.offset) || 0);

    // Past weeks: always read from pre-computed weekly_reports table
    if (offset > 0) {
      const report = await WeeklyReport.getByOffset(userId, offset);
      if (!report) {
        return res.json({ empty: true, offset, message: 'Chưa có báo cáo cho tuần này.' });
      }
      return res.json({ ...report.data, weekStart: report.weekStart, isLive: false });
    }

    // Current week: check in-memory cache first
    const cacheKey = userId;
    const cached = liveReportCache.get(cacheKey);
    if (cached && Date.now() < cached.expiredAt) {
      return res.json(cached.data);
    }

    // Cache miss → check if agent already pre-computed this week
    const { weekStart } = getWeekRange(0);
    const precomputed = await WeeklyReport.getByWeekStart(userId, weekStart);
    if (precomputed) {
      const data = { ...precomputed.data, weekStart: precomputed.weekStart, isLive: false };
      liveReportCache.set(cacheKey, { data, expiredAt: Date.now() + CACHE_TTL_MS });
      return res.json(data);
    }

    // No pre-computed data → compute live
    const data = await computeLiveReport(userId, 0);
    liveReportCache.set(cacheKey, { data, expiredAt: Date.now() + CACHE_TTL_MS });
    return res.json(data);
  } catch (err) {
    next(err);
  }
};

module.exports = { getWeeklyReport };
