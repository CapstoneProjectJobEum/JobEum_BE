// 관리자가 인증(로그인 여부)과 권한(역할) 체크를 공통 처리하기 위해 만든 API
// 중복제거와 관리자 전용 API나 기업회원 전용 API에서 사용하는 미들웨어
function requireAuth(req, res, next) {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    next();
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        next();
    };
}
module.exports = { requireAuth, requireRole };