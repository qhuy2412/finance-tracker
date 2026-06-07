import api from './api';

/**
 * Get weekly report data.
 * @param {number} offset - 0 = current week, 1 = last week, etc.
 */
export const getWeeklyReport = (offset = 0) =>
  api.get(`/reports/weekly?offset=${offset}`).then((r) => r.data);
