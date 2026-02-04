const express = require("express");
const router = express.Router();
const db = require("../database/db");
const verificarAutenticacao = require("../middlewares/auth.middleware");

// Função auxiliar (pode mover para um helper depois)
const verificarSeEhAdmin = (user) => {
    if (user.email === 'admin@admin.com') return true;
    if (user.nome_perfil === 'Administrador' || user.nome_perfil === 'Super Admin') return true;
    return false;
};

// --- LISTAR EPCs ---
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);
        const idUnidadeUsuario = userLogado.id_unidade || userLogado.unidade_id;

        // Base da Query
        let query = `
            SELECT 
                id_epc, 
                id_unidade, 
                nome, 
                observacoes, 
                ativo 
            FROM epc 
            WHERE ativo = 1 
        `;

        const params = [];

        // LÓGICA DE ISOLAMENTO
        if (!ehAdmin) {
            // Usuário comum: Vê Global (NULL) OU da sua Unidade
            query += ` AND (id_unidade IS NULL OR id_unidade = ?)`;
            params.push(idUnidadeUsuario);
        }
        // Admin: Vê tudo (não adiciona filtro de unidade)

        query += ` ORDER BY nome ASC`;

        const [epcs] = await db.query(query, params);

        res.render("estoque/epc-lista", {
            user: userLogado,
            currentPage: 'epc',
            epcsJson: JSON.stringify(epcs)
        });

    } catch (error) {
        console.error("Erro ao listar EPCs:", error);
        res.status(500).send("Erro ao carregar lista.");
    }
});

// --- TELA DE NOVO EPC ---
router.get("/novo", verificarAutenticacao, (req, res) => {
    res.render("estoque/epc-form", { user: req.session.user, currentPage: 'epc-novo' });
});

// --- SALVAR NOVO EPC ---
router.post("/novo", verificarAutenticacao, async (req, res) => {
    try {
        const { nome, obs } = req.body;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        if (!nome) {
            return res.status(400).json({ success: false, message: "O nome do EPC é obrigatório." });
        }

        // LÓGICA DE ISOLAMENTO
        let idUnidadeParaSalvar = null;

        if (ehAdmin) {
            idUnidadeParaSalvar = null;
        } else {
            idUnidadeParaSalvar = userLogado.id_unidade || userLogado.unidade_id;
        }

        await db.query(`
            INSERT INTO epc (id_unidade, nome, observacoes, ativo)
            VALUES (?, ?, ?, 1)
        `, [idUnidadeParaSalvar, nome, obs]);

        // MUDANÇA AQUI: Retorna JSON em vez de redirect
        return res.json({ success: true, message: "EPC cadastrado com sucesso!" });

    } catch (error) {
        console.error("Erro ao salvar EPC:", error);
        return res.status(500).json({ success: false, message: "Erro interno ao salvar EPC." });
    }
});

// --- INATIVAR MÚLTIPLOS ---
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

        // Query de inativação (Soft Delete usando 'ativo = 0')
        let sql = `UPDATE epc SET ativo = 0 WHERE id_epc IN (${validIds.map(() => '?').join(',')})`;
        const params = [...validIds];

        // SEGURANÇA:
        // Se não for Admin, adiciona trava para só deletar EPCs da própria unidade.
        // Isso impede que um usuário comum apague um EPC Global.
        if (!ehAdmin) {
            sql += ` AND id_unidade = ?`;
            params.push(idUnidadeUsuario);
        }

        await db.query(sql, params);

        return res.json({ success: true, message: "EPCs inativados com sucesso." });

    } catch (error) {
        console.error("Erro ao inativar EPCs:", error);
        return res.status(500).json({ success: false, message: "Erro interno." });
    }
});

module.exports = router;