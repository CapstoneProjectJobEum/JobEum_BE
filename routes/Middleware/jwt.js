const jwt = require('jsonwebtoken');

module.exports = function attachUser(req, res, next) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded; // payload 정보 주입
        } catch (err) {
            // 토큰이 만료되거나 유효하지 않은 경우, req.user는 undefined로 둔다
            req.user = null;
        }
    }
    next();
};
