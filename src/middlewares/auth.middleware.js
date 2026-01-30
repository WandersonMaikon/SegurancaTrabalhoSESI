const verificarAutenticacao = (req, res, next) => {
    // 1. Verifica se o usuário está logado
    if (!req.session || !req.session.user) {
        return res.redirect("/login");
    }

    // 2. Disponibiliza o usuário para TODAS as views EJS automaticamente
    res.locals.user = req.session.user;

    // 3. Cria a função 'can' para verificar permissões direto no HTML/EJS

    res.locals.can = (modulo, acao = 'ver') => {
        const perms = req.session.user.permissoes;

        // Se o usuário não tem permissões carregadas ou o módulo não existe, nega acesso
        if (!perms || !perms[modulo]) {
            return false;
        }

        // Retorna true se a permissão for verdadeira (1 ou true)
        return perms[modulo][acao] === true || perms[modulo][acao] === 1;
    };

    next();
};

module.exports = verificarAutenticacao;