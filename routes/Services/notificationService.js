// services/notificationService.js
const db = require('../../db');

// 실시간 송신
function emitToUser(io, userId, event, payload) {
    io.to(`user:${userId}`).emit(event, payload);
}

// 사용자가 해당 알림 받도록 설정했는지 체크
async function isAllowedNotification(userId, type, role) {
    if (!role) return false; // role 없으면 차단

    const [rows] = await db.query(
        `SELECT all_notifications, settings
         FROM notification_settings
         WHERE user_id=? AND role=?`,
        [userId, role]
    );

    // DB에 없으면 → 기본 차단
    if (!rows.length) return false;

    const { all_notifications, settings } = rows[0];
    const parsedSettings = typeof settings === 'string' ? JSON.parse(settings) : settings;

    if (all_notifications === 0) return false;

    switch (type) {
        case 'NEW_JOB_FROM_FAVORITE_COMPANY':
            return !!parsedSettings.newJobFromFollowedCompany;
        case 'FAVORITE_JOB_DEADLINE':
            return !!parsedSettings.favoriteJobDeadline;
        case 'EMP_JOB_DEADLINE':
            return !!parsedSettings.empJobDeadline;
        case 'APPLICATION_STATUS_UPDATE':
            return !!parsedSettings.applicationStatusChange;
        case 'EMP_APPLICATION_RECEIVED':
            return !!parsedSettings.newApplicant;
        case 'EMP_JOB_DELETED_BY_ADMIN':
            return !!parsedSettings.adminDeletedJob;
        case 'ADMIN_INQUIRY_CREATED':
            return !!parsedSettings.newInquiry;
        case 'ADMIN_REPORT_CREATED':
            return !!parsedSettings.newReport;
        case 'INQUIRY_REPORT_ANSWERED':
            return !!parsedSettings.inquiryReportAnswered;
        default:
            return true;
    }

}

// 단일 알림 생성
async function createNotification(io, { userId, role, type, title, message, metadata = null, force = false }) {
    if (!role) throw new Error('Notification role is required');

    // force가 아닌 경우에만 설정 체크
    if (!force && !(await isAllowedNotification(userId, type, role))) return null;

    const [r] = await db.query(
        `INSERT INTO notifications (user_id, type, title, message, metadata)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, type, title, message, metadata ? JSON.stringify(metadata) : null]
    );

    const notification = {
        id: r.insertId,
        user_id: userId,
        type,
        title,
        message,
        metadata,
        is_read: 0,
        created_at: new Date().toISOString()
    };

    emitToUser(io, userId, 'notification:new', notification);
    return notification;
}

// 다중 알림 생성
async function createBulkNotifications(io, rows) {
    const filteredRows = [];

    for (const r of rows) {
        if (!r.role) continue; // role 없으면 skip
        if (await isAllowedNotification(r.userId, r.type, r.role)) {
            filteredRows.push(r);
        }
    }

    if (!filteredRows.length) return 0;

    const values = filteredRows.map(r => [
        r.userId,
        r.type,
        r.title,
        r.message,
        r.metadata ? JSON.stringify(r.metadata) : null
    ]);

    const [result] = await db.query(
        `INSERT INTO notifications (user_id, type, title, message, metadata)
         VALUES ?`,
        [values]
    );

    for (const r of filteredRows) {
        emitToUser(io, r.userId, 'notification:new', {
            ...r,
            id: null,
            is_read: 0,
            created_at: new Date().toISOString()
        });
    }

    return result.affectedRows;
}

module.exports = {
    emitToUser,
    createNotification,
    createBulkNotifications,
};
