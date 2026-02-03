const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { v4: uuidv4 } = require('uuid');
const verificarAutenticacao = require("../middlewares/auth.middleware");

// --- LISTAR RISCOS ---
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        // AJUSTE: Usando LEFT() para limitar os caracteres no SELECT
        const [riscos] = await db.query(`
            SELECT 
                r.id_risco, 
                LEFT(r.nome_risco, 70) AS nome_risco, 
                r.tipo_risco, 
                t24.codigo AS codigo_esocial
            FROM risco r
            LEFT JOIN tabela_24_esocial t24 ON r.id_tabela_24 = t24.id_tabela_24
            WHERE r.deleted_at IS NULL 
            ORDER BY r.nome_risco ASC
        `);

        // Dica: Se quiser adicionar "..." caso o texto seja cortado, 
        // teria que fazer uma lógica mais complexa com CONCAT e IF no SQL, 
        // ou tratar no front. Aqui ele vai cortar seco no caractere 70.

        res.render("estoque/risco-lista", {
            user: req.session.user,
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

// --- API: BUSCAR DADOS DO ESOCIAL (TABELA 24) ---
router.get("/buscar-esocial/:codigo", verificarAutenticacao, async (req, res) => {
    try {
        const { codigo } = req.params;

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

// --- SALVAR NOVO RISCO ---
router.post("/novo", verificarAutenticacao, async (req, res) => {
    try {
        const { id_tabela_24, nome_risco, tipo_risco } = req.body;

        if (!nome_risco || !tipo_risco) {
            return res.status(400).send("Campos obrigatórios faltando.");
        }

        const idTabela = id_tabela_24 ? id_tabela_24 : null;

        await db.query(`
            INSERT INTO risco (id_tabela_24, nome_risco, tipo_risco)
            VALUES (?, ?, ?)
        `, [idTabela, nome_risco, tipo_risco]);

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
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: "Nenhum registro selecionado." });
        }

        const validIds = ids.map(id => String(id).trim()).filter(id => id.length > 0);

        if (validIds.length === 0) {
            return res.status(400).json({ success: false, message: "IDs inválidos." });
        }

        const placeholders = validIds.map(() => '?').join(',');

        const sql = `UPDATE risco SET deleted_at = NOW() WHERE id_risco IN (${placeholders})`;
        await db.query(sql, validIds);

        return res.json({ success: true, message: "Riscos inativados com sucesso." });
    } catch (error) {
        console.error("Erro ao inativar riscos:", error);
        return res.status(500).json({ success: false, message: "Erro interno ao inativar riscos." });
    }
});

module.exports = router;