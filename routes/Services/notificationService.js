const db = require('../../db');

// 알림 서비스 API (DB 저장 + 실시간 emit)
function emitToUser(io, userId, event, payload) {
  io.to(`user:${userId}`).emit(event, payload);
}

async function createNotification(io, { userId, type, title, message, metadata = null }) {
  const [r] = await db.query(
    `INSERT INTO notifications (user_id, type, title, message, metadata)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, type, title, message, metadata ? JSON.stringify(metadata) : null]
  );

  const notification = {
    id: r.insertId, user_id: userId, type, title, message, metadata,
    is_read: 0, created_at: new Date().toISOString()
  };

  // 실시간 송신
  emitToUser(io, userId, 'notification:new', notification);
  return notification;
}

async function createBulkNotifications(io, rows) {
  if (!rows?.length) return 0;
  const values = rows.map(r => [
    r.userId, r.type, r.title, r.message, r.metadata ? JSON.stringify(r.metadata) : null
  ]);
  const [result] = await db.query(
    `INSERT INTO notifications (user_id, type, title, message, metadata)
     VALUES ?`,
    [values]
  );

  for (const r of rows) {
    emitToUser(io, r.userId, 'notification:new', {
      ...r, id: null, is_read: 0, created_at: new Date().toISOString()
    });
  }
  return result.affectedRows;
}

module.exports = { createNotification, createBulkNotifications };
