// src/middlewares/auth.middleware.js

const verificarAutenticacao = (req, res, next) => {
    // 1. Verifica se o usuário está logado
    if (!req.session || !req.session.user) {
        return res.redirect("/login");
    }

    const user = req.session.user;

    // 2. Disponibiliza o usuário para TODAS as views EJS automaticamente
    res.locals.user = user;

    // 3. Cria a função 'can' para verificar permissões direto no HTML/EJS
    // Exemplo de uso no EJS: <% if (can('riscos', 'pode_editar')) { %> ... <% } %>
    res.locals.can = (modulo, acao = 'ver') => {
        // A. Bypass Admin no Front-end também (para ver todos os botões)
        if (user.email === 'admin@admin.com' || user.nome_perfil === 'Administrador' || user.nome_perfil === 'Super Admin') {
            return true;
        }

        const perms = user.permissoes;

        // B. Se não tem módulo, nega
        if (!perms || !perms[modulo]) {
            return false;
        }

        const alvo = perms[modulo];

        // C. Função auxiliar de verdade (Igual ao permission middleware)
        const isTrue = (val) => val === 1 || val === '1' || val === true || val === 'true';

        // D. Verifica Ação OU Tudo
        const acaoLimpa = acao.replace('pode_', '');
        
        return isTrue(alvo[acao]) || isTrue(alvo[`pode_${acaoLimpa}`]) || isTrue(alvo[acaoLimpa]) || isTrue(alvo['tudo']);
    };

    next();
};

module.exports = verificarAutenticacao;