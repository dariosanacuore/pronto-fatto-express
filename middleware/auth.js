export function auth(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({
            message: "Devi effettuare il login"
        });
    }

    req.user = req.session.user;
    next();
}