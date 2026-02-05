// src/middlewares/permission.middleware.js

/**
 * Middleware para verificar permissão de acesso a um módulo.
 * @param {string} modulo - A chave do módulo (ex: 'riscos', 'usuarios')
 * @param {string} acao - A ação necessária (ex: 'pode_editar', 'pode_criar')
 */
const verificarPermissao = (modulo, acao = 'ver') => {
    return (req, res, next) => {
        // 1. Verifica login e sessão
        if (!req.session || !req.session.user) {
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(401).json({ success: false, message: 'Sessão expirada.' });
            }
            return res.redirect('/login');
        }

        const user = req.session.user;

        // ============================================================
        // 2. BYPASS DE SUPER ADMIN (PASSE LIVRE)
        // ============================================================
        // Se for o Admin Supremo, não perde tempo checando permissão
        if (user.email === 'admin@admin.com' || user.nome_perfil === 'Administrador' || user.nome_perfil === 'Super Admin') {
            return next();
        }

        const perms = user.permissoes;

        // 3. Verifica se o módulo existe na sessão do usuário
        if (!perms || !perms[modulo]) {
            console.log(`[BLOQUEIO] Usuário ${user.email} tentou acessar módulo '${modulo}' (Sem registro na sessão).`);

            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(403).json({ success: false, message: 'Acesso negado ao módulo.' });
            }
            return res.redirect('/dashboard?alert=acesso_negado');
        }

        const alvo = perms[modulo];

        // 4. FUNÇÃO AUXILIAR DE VERDADE (Blindagem de Tipos)
        // Aceita: 1, "1", true, "true"
        const isTrue = (val) => val === 1 || val === '1' || val === true || val === 'true';

        // 5. REGRA DE OURO: Verifica Ação Específica OU Poder Total ("tudo")
        const acaoLimpa = acao.replace('pode_', '');

        const temPermissaoEspecifica = isTrue(alvo[acao]) || isTrue(alvo[`pode_${acaoLimpa}`]) || isTrue(alvo[acaoLimpa]);
        const temPermissaoTotal = isTrue(alvo['tudo']);

        if (!temPermissaoEspecifica && !temPermissaoTotal) {
            console.log(`[BLOQUEIO] Usuário ${user.email} barrou em '${acao}' no módulo '${modulo}'`);

            // A. SE FOR REQUISIÇÃO API (Botão Salvar/Inativar) -> Retorna JSON 403
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(403).json({ success: false, message: 'Você não tem permissão para realizar esta ação.' });
            }

            // B. SE FOR NAVEGAÇÃO (Clicou no link editar) -> Redireciona com ?alert
            // Ajusta plural para singular na URL (riscos -> risco)
            let rotaDestino = modulo;
            if (modulo === 'riscos') rotaDestino = 'risco';

            return res.redirect(`/${rotaDestino}?alert=sem_permissao`);
        }

        // 6. Passou!
        next();
    };
};

module.exports = verificarPermissao;