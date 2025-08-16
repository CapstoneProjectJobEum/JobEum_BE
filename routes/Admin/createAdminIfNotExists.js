const bcrypt = require('bcryptjs');
const db = require('../../db');
require('dotenv').config();

async function createAdminIfNotExists() {
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
        console.warn('ADMIN_USERNAME 또는 ADMIN_PASSWORD가 설정되어 있지 않습니다.');
        return;
    }

    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [adminUsername]);
        if (rows.length > 0) {
            console.log('관리자 계정이 이미 존재합니다.');
            return;
        }

        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        const adminUser = {
            username: adminUsername,
            password: hashedPassword,
            user_type: '개인회원',  // 관리자용 기본 user_type 지정 (필요 시 변경)
            role: 'ADMIN',
            email: null,
            phone: null,
            name: '관리자',
            birth: null,
            gender: null,
            company: null,
            biz_number: null,
            manager: null,
        };

        const [result] = await db.query('INSERT INTO users SET ?', adminUser);
        console.log(`관리자 계정이 생성되었습니다. (ID: ${result.insertId})`);
    } catch (err) {
        console.error('관리자 계정 생성 중 오류:', err);
    }
}

module.exports = createAdminIfNotExists;