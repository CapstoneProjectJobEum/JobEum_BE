const db = require('../db');

async function ensureNotificationSettings(userId, role) {
    const [rows] = await db.query(
        `SELECT id FROM notification_settings WHERE user_id = ? AND role = ?`,
        [userId, role]
    );

    if (rows.length === 0) {
        let defaultSettings = {};
        if (role === 'MEMBER') {
            defaultSettings = {
                newJobFromFollowedCompany: 1,
                favoriteJobDeadline: 1,
                applicationStatusChange: 1,
                inquiryReportAnswered: 1
            };
        } else if (role === 'COMPANY') {
            defaultSettings = {
                newApplicant: 1,
                empJobDeadline: 1,
                adminDeletedJob: 1,
                inquiryReportAnswered: 1
            };
        } else if (role === 'ADMIN') {
            defaultSettings = {
                newInquiry: 1,
                newReport: 1
            };
        }

        await db.query(
            `INSERT INTO notification_settings (user_id, role, all_notifications, settings)
       VALUES (?, ?, ?, ?)`,
            [userId, role, 1, JSON.stringify(defaultSettings)]
        );
    }
}

module.exports = { ensureNotificationSettings };
