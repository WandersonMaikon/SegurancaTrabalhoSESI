// src/middlewares/auth.middleware.js

const verificarAutenticacao = (req, res, next) => {
    // 1. Verifica se o usuário está logado
    if (!req.session || !req.session.user) {
        return res.redirect("/login");
    }

    const user = req.session.user;

    // =========================================================================
    // NOVO: TRAVA DE PRIMEIRO ACESSO
    // Se a flag estiver ativa, barra o usuário de acessar qualquer outra rota
    // =========================================================================
    if (user.primeiro_acesso) {
        // Rotas que ele PODE acessar mesmo estando bloqueado
        const urlPermitidas = ['/primeiro-acesso', '/logout'];

        // Verifica se é arquivo estático (CSS, JS, Imagens, Vendor) ou API
        const isStaticOrApi = req.originalUrl.startsWith('/api') ||
            req.originalUrl.startsWith('/vendor') ||
            req.originalUrl.startsWith('/css') ||
            req.originalUrl.startsWith('/images') ||
            req.originalUrl.startsWith('/js');

        // Se ele não estiver indo para uma rota permitida, força o redirecionamento
        if (!urlPermitidas.includes(req.originalUrl) && !isStaticOrApi) {
            return res.redirect('/primeiro-acesso');
        }
    }
    // =========================================================================

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