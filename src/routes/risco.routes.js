const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { v4: uuidv4 } = require('uuid');
const verificarAutenticacao = require("../middlewares/auth.middleware");

// Função auxiliar para verificar Admin (Reutilize se já tiver em um helper)
const verificarSeEhAdmin = (user) => {
    if (user.email === 'admin@admin.com') return true;
    if (user.nome_perfil === 'Administrador' || user.nome_perfil === 'Super Admin') return true;
    return false;
};

// --- LISTAR RISCOS (COM ISOLAMENTO) ---
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);
        const idUnidadeUsuario = userLogado.id_unidade || userLogado.unidade_id;

        let query = `
            SELECT 
                r.id_risco, 
                LEFT(r.nome_risco, 70) AS nome_risco, 
                r.tipo_risco, 
                t24.codigo AS codigo_esocial,
                r.id_unidade
            FROM risco r
            LEFT JOIN tabela_24_esocial t24 ON r.id_tabela_24 = t24.id_tabela_24
            WHERE r.deleted_at IS NULL 
        `;

        const params = [];

        // LÓGICA DE ISOLAMENTO HÍBRIDO:
        // Se NÃO for Admin, filtra: (Globais OU Da Minha Unidade)
        if (!ehAdmin) {
            query += ` AND (r.id_unidade IS NULL OR r.id_unidade = ?)`;
            params.push(idUnidadeUsuario);
        }
        // Se for Admin, ele vê tudo (sem filtro de unidade), então não adicionamos cláusula AND extra.

        query += ` ORDER BY r.nome_risco ASC`;

        const [riscos] = await db.query(query, params);

        res.render("estoque/risco-lista", {
            user: userLogado,
            currentPage: 'risco',
            riscosJson: JSON.stringify(riscos)
        });
    } catch (error) {
        console.error("Erro ao listar riscos:", error);
        res.status(500).send("Erro ao carregar lista de riscos.");
    }
});

// --- TELA DE NOVO RISCO ---
router.get("/novo", verificarAutenticacao, (req, res) => {
    res.render("estoque/risco-form", { user: req.session.user, currentPage: 'risco-novo' });
});

// --- API: BUSCAR DADOS DO ESOCIAL (TABELA 24) - ACESSO GLOBAL ---
router.get("/buscar-esocial/:codigo", verificarAutenticacao, async (req, res) => {
    try {
        const { codigo } = req.params;

        // Tabela 24 é catálogo do governo, acesso livre para todos os autenticados
        const [rows] = await db.query(
            "SELECT id_tabela_24, grupo, descricao FROM tabela_24_esocial WHERE codigo = ?",
            [codigo]
        );

        if (rows.length > 0) {
            return res.json({ success: true, data: rows[0] });
        } else {
            return res.json({ success: false, message: "Código não encontrado." });
        }

    } catch (error) {
        console.error("Erro na API eSocial:", error);
        return res.status(500).json({ success: false, message: "Erro no servidor." });
    }
});

// --- SALVAR NOVO RISCO (COM VÍNCULO DE UNIDADE) ---
router.post("/novo", verificarAutenticacao, async (req, res) => {
    try {
        const { id_tabela_24, nome_risco, tipo_risco } = req.body;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        if (!nome_risco || !tipo_risco) {
            return res.status(400).send("Campos obrigatórios faltando.");
        }

        const idTabela = id_tabela_24 ? id_tabela_24 : null;

        // DEFINIÇÃO DE UNIDADE NO CADASTRO
        let idUnidadeParaSalvar = null;

        if (ehAdmin) {
            // Admin cria riscos GLOBAIS (Padrão do Sistema)
            idUnidadeParaSalvar = null;
        } else {
            // Usuário comum cria risco LOCAL (Exclusivo da Unidade)
            idUnidadeParaSalvar = userLogado.id_unidade || userLogado.unidade_id;
        }

        await db.query(`
            INSERT INTO risco (id_unidade, id_tabela_24, nome_risco, tipo_risco)
            VALUES (?, ?, ?, ?)
        `, [idUnidadeParaSalvar, idTabela, nome_risco, tipo_risco]);

        res.redirect("/risco");

    } catch (error) {
        console.error("Erro ao salvar risco:", error);
        res.status(500).send("Erro ao salvar risco.");
    }
});

// --- INATIVAR MÚLTIPLOS RISCOS ---
router.post("/inativar-multiplos", verificarAutenticacao, async (req, res) => {
    try {
        const { ids } = req.body;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);
        const idUnidadeUsuario = userLogado.id_unidade || userLogado.unidade_id;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: "Nenhum registro selecionado." });
        }

        const validIds = ids.map(id => String(id).trim()).filter(id => id.length > 0);

        if (validIds.length === 0) {
            return res.status(400).json({ success: false, message: "IDs inválidos." });
        }

        // SEGURANÇA NA EXCLUSÃO:
        // Admin pode inativar qualquer um.
        // Usuário comum só pode inativar riscos DA PRÓPRIA UNIDADE.

        let sql = `UPDATE risco SET deleted_at = NOW() WHERE id_risco IN (${validIds.map(() => '?').join(',')})`;
        const params = [...validIds];

        if (!ehAdmin) {
            // Adiciona cláusula extra para garantir que usuário não delete risco global ou de outra unidade
            sql += ` AND id_unidade = ?`;
            params.push(idUnidadeUsuario);
        }

        const [result] = await db.query(sql, params);

        // Se usuário comum tentou deletar risco global, result.affectedRows será 0 ou menor que o esperado.
        // Podemos tratar isso visualmente se quiser, mas a segurança está feita.

        return res.json({ success: true, message: "Operação concluída." });
    } catch (error) {
        console.error("Erro ao inativar riscos:", error);
        return res.status(500).json({ success: false, message: "Erro interno ao inativar riscos." });
    }
});

module.exports = router;