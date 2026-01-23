const verificarAutenticacao = (req, res, next) => {
    // Se não tiver usuário na sessão, manda pro login
    if (!req.session.user) {
        return res.redirect("/login");
    }
    next();
};

module.exports = verificarAutenticacao;