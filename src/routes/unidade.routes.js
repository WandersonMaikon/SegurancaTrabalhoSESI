const express = require("express");
const router = express.Router();
const db = require("../database/db");
const verificarAutenticacao = require("../middlewares/auth.middleware");
const { v4: uuidv4 } = require('uuid');

// --- Rota: Listar Unidades ---
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        const [unidades] = await db.query("SELECT * FROM unidade ORDER BY created_at DESC");
        res.render("unidade/unidade-lista", {
            user: req.session.user,
            currentPage: 'unidade',
            unidades: unidades
        });
    } catch (error) {
        console.error("Erro ao buscar unidades:", error);
        res.status(500).send("Erro ao carregar as unidades.");
    }
});

// --- Rota: Tela de Cadastro ---
router.get("/novo", verificarAutenticacao, (req, res) => {
    res.render("unidade/unidade-form", {
        user: req.session.user,
        currentPage: 'unidade-novo'
    });
});

// --- Rota: Processar Cadastro (POST via JSON) ---
router.post("/salvar", verificarAutenticacao, async (req, res) => {
    try {
        const { nome_fantasia, razao_social, cnpj, cidade, estado } = req.body;

        // Validação básica no back-end
        if (!nome_fantasia || !cnpj) {
            return res.status(400).json({
                success: false,
                message: "Nome Fantasia e CNPJ são obrigatórios."
            });
        }

        const id_unidade = uuidv4();

        const sql = `
            INSERT INTO unidade (id_unidade, nome_fantasia, razao_social, cnpj, cidade, estado, ativo)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        await db.query(sql, [id_unidade, nome_fantasia, razao_social, cnpj, cidade, estado, 1]);

        // Sucesso: Retorna JSON para o SweetAlert
        return res.status(200).json({
            success: true,
            message: "Unidade cadastrada com sucesso!"
        });

    } catch (error) {
        console.error("Erro ao salvar unidade:", error);

        // Tratamento de erro de duplicidade
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                message: "Este CNPJ já está cadastrado no sistema."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Erro interno ao salvar a unidade."
        });
    }
});

module.exports = router;