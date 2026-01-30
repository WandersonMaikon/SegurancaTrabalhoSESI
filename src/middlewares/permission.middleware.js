// src/middlewares/permission.middleware.js

/**
 * Middleware para verificar permissão de acesso a um módulo.
 * @param {string} modulo - A chave do módulo (ex: 'usuarios', 'financeiro')
 * @param {string} acao - A ação necessária (padrão: 'ver')
 */
const verificarPermissao = (modulo, acao = 'ver') => {
    return (req, res, next) => {
        // 1. Verifica se o usuário está logado (segurança básica)
        // Nota: O auth.middleware já deve ter rodado antes, mas garantimos aqui
        if (!req.session || !req.session.user) {
            return res.redirect('/login');
        }

        const user = req.session.user;
        const perms = user.permissoes;

        // 2. Verifica se existe a permissão no objeto de sessão
        if (!perms || !perms[modulo]) {
            console.log(`[BLOQUEIO] Usuário ${user.email} tentou acessar módulo ${modulo} sem permissão.`);
            return res.redirect('/dashboard');
        }

        // 3. Verifica a ação específica (ver, criar, editar, inativar)
        // Aceita true ou 1 (dependendo do banco de dados)
        const temPermissao = perms[modulo][acao] === true || perms[modulo][acao] === 1;

        if (!temPermissao) {
            console.log(`[BLOQUEIO] Usuário ${user.email} sem permissão de '${acao}' em '${modulo}'`);
            return res.redirect('/dashboard');
        }

        // 4. Se passou por tudo, segue o baile
        next();
    };
};

module.exports = verificarPermissao;