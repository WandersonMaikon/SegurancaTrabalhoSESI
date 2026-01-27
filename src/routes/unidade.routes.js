const express = require("express");
const router = express.Router();
const db = require("../database/db");
const verificarAutenticacao = require("../middlewares/auth.middleware");
const { v4: uuidv4 } = require('uuid');

// --- Rota: Listar Unidades ---
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        // CORREÇÃO AQUI: Adicionado o * (asterisco) entre SELECT e FROM
        const [unidades] = await db.query("SELECT * FROM unidade ORDER BY created_at DESC");

        res.render("unidade/unidade-lista", {
            user: req.session.user,
            currentPage: 'unidade',
            unidades: unidades,
            // Envia os dados como string JSON para o front-end (Técnica do Elemento Oculto)
            unidadesJson: JSON.stringify(unidades)
        });
    } catch (error) {
        console.error("Erro ao buscar unidades:", error);
        res.status(500).send("Erro ao carregar as unidades.");
    }
});

// --- Rota: INATIVAR MÚLTIPLAS ---
router.post("/inativar-multiplas", verificarAutenticacao, async (req, res) => {
    try {
        const { ids } = req.body;

        console.log("IDs recebidos para inativação:", ids);

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: "Nenhum ID recebido." });
        }

        // Limpeza dos IDs
        const validIds = ids.map(id => String(id).trim()).filter(id => id.length > 0);

        if (validIds.length === 0) {
            return res.status(400).json({ success: false, message: "IDs inválidos." });
        }

        // Executa a query
        const placeholders = validIds.map(() => '?').join(',');
        const sql = `UPDATE unidade SET ativo = 0 WHERE id_unidade IN (${placeholders})`;

        const [result] = await db.query(sql, validIds);

        return res.status(200).json({
            success: true,
            message: `${result.affectedRows} unidade(s) inativada(s) com sucesso!`
        });

    } catch (error) {
        console.error("ERRO NO SERVIDOR:", error);
        return res.status(500).json({
            success: false,
            message: "Erro interno ao processar a solicitação."
        });
    }
});

// --- Rota: Tela de Cadastro ---
router.get("/novo", verificarAutenticacao, (req, res) => {
    res.render("unidade/unidade-form", {
        user: req.session.user,
        currentPage: 'unidade-novo'
    });
});

// --- Rota: Processar Cadastro ---
router.post("/salvar", verificarAutenticacao, async (req, res) => {
    try {
        const { nome_fantasia, razao_social, cnpj, cidade, estado } = req.body;

        if (!nome_fantasia || !cnpj) {
            return res.status(400).json({ success: false, message: "Dados incompletos." });
        }

        const id_unidade = uuidv4();

        const sql = `
            INSERT INTO unidade (id_unidade, nome_fantasia, razao_social, cnpj, cidade, estado, ativo)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        await db.query(sql, [id_unidade, nome_fantasia, razao_social, cnpj, cidade, estado, 1]);

        return res.status(200).json({ success: true, message: "Unidade cadastrada!" });

    } catch (error) {
        console.error("Erro ao salvar:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: "CNPJ já cadastrado." });
        }
        return res.status(500).json({ success: false, message: "Erro ao salvar." });
    }
});

module.exports = router;