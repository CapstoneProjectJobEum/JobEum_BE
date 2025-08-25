const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const pool = require('../../db');
require('dotenv').config();
const { ensureNotificationSettings } = require('../../utils/createDefaultNotification');

// JWT 생성 함수
const createJWT = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email, user_type: user.user_type, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
};

const mapGender = (gender) => {
    if (!gender) return null;
    const g = gender.toLowerCase();
    if (g === 'male' || g === 'm') return '남자';
    if (g === 'female' || g === 'f') return '여자';
    return null;
};

const formatPhoneNumber = (raw) => {
    if (!raw) return null;
    let digits = raw.replace(/[^0-9]/g, '');
    if (digits.startsWith('82')) digits = '0' + digits.slice(2);
    return digits;
};

// DB에서 유저 찾거나 생성
const findOrCreateUser = async (userData) => {
    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.query(
            'SELECT * FROM users WHERE sns_id = ? AND sns_provider = ?',
            [userData.sns_id, userData.sns_provider]
        );
        if (rows.length > 0) return rows[0];

        const [result] = await conn.query(
            `INSERT INTO users (user_type, name, gender, birth, email, phone, sns_id, sns_provider)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ['개인회원', userData.name, userData.gender, userData.birth, userData.email, userData.phone, userData.sns_id, userData.sns_provider]
        );

        const [newRows] = await conn.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
        return newRows[0];
    } finally {
        conn.release();
    }
};

// 카카오 콜백 처리
router.get('/oauth/kakao/callback', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) return res.status(400).json({ error: 'code가 없습니다.' });

        const tokenRes = await axios.post(
            'https://kauth.kakao.com/oauth/token',
            new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: process.env.KAKAO_CLIENT_ID,
                redirect_uri: process.env.KAKAO_REDIRECT_URI,
                code,
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const accessToken = tokenRes.data.access_token;

        const userRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        const kakao = userRes.data.kakao_account;
        const userData = {
            sns_id: userRes.data.id.toString(),
            sns_provider: 'kakao',
            name: kakao.name,
            email: kakao.email,
            gender: mapGender(kakao.gender),
            birth: kakao.birthyear && kakao.birthday
                ? `${kakao.birthyear}${kakao.birthday.replace(/[^0-9]/g, '')}`
                : null,
            phone: formatPhoneNumber(kakao.phone_number),
        };

        const user = await findOrCreateUser(userData);

        // 로그인 시 알림 설정 초기화
        await ensureNotificationSettings(user.id, user.role);

        const token = createJWT(user);
        res.json({ user, token });
    } catch (err) {
        console.error('카카오 로그인 에러:', err);
        res.status(500).json({ error: '카카오 로그인 실패', detail: err.message });
    }
});

// 네이버 콜백 처리
router.get('/oauth/naver/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code || !state) return res.status(400).json({ error: 'code 또는 state가 없습니다.' });

        const tokenRes = await axios.get('https://nid.naver.com/oauth2.0/token', {
            params: {
                grant_type: 'authorization_code',
                client_id: process.env.NAVER_CLIENT_ID,
                client_secret: process.env.NAVER_CLIENT_SECRET,
                redirect_uri: process.env.NAVER_REDIRECT_URI,
                code,
                state,
            },
        });

        const accessToken = tokenRes.data.access_token;

        const userRes = await axios.get('https://openapi.naver.com/v1/nid/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        const profile = userRes.data.response;
        const userData = {
            sns_id: profile.id,
            sns_provider: 'naver',
            name: profile.name,
            email: profile.email,
            gender: mapGender(profile.gender),
            birth: profile.birthyear && profile.birthday
                ? `${profile.birthyear}${profile.birthday.replace(/[^0-9]/g, '')}`
                : null,
            phone: formatPhoneNumber(profile.mobile),
        };

        const user = await findOrCreateUser(userData);

        // 로그인 시 알림 설정 초기화
        await ensureNotificationSettings(user.id, user.role);

        const token = createJWT(user);
        res.json({ user, token });
    } catch (err) {
        console.error('네이버 로그인 에러:', err);
        res.status(500).json({ error: '네이버 로그인 실패', detail: err.message });
    }
});

module.exports = router;
