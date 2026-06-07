import api from './api';

export const getNotifications = () =>
  api.get('/notifications').then(r => r.data);

export const getUnreadCount = () =>
  api.get('/notifications/unread-count').then(r => r.data);

export const markRead = (id) =>
  api.patch(`/notifications/${id}/read`).then(r => r.data);

export const markAllRead = () =>
  api.patch('/notifications/read-all').then(r => r.data);

