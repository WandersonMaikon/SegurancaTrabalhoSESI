const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { v4: uuidv4 } = require('uuid');

// 1. Importa o middleware de Login e Permissão
const verificarAutenticacao = require("../middlewares/auth.middleware");
const verificarPermissao = require("../middlewares/permission.middleware");


// --- Rota: Listar Unidades ---
// Proteção: Ver
router.get("/",
    verificarAutenticacao,
    verificarPermissao('unidades', 'ver'),
    async (req, res) => {
        try {
            const [unidades] = await db.query("SELECT * FROM unidade ORDER BY created_at DESC");

            res.render("unidade/unidade-lista", {
                user: req.session.user,
                currentPage: 'unidade',
                unidades: unidades,
                // Envia os dados como string JSON para o front-end
                unidadesJson: JSON.stringify(unidades)
            });
        } catch (error) {
            console.error("Erro ao buscar unidades:", error);
            res.status(500).send("Erro ao carregar as unidades.");
        }
    });

// --- Rota: INATIVAR MÚLTIPLAS ---
// Proteção: Inativar (Já que inativar é um soft delete)
router.post("/inativar-multiplas",
    verificarAutenticacao,
    verificarPermissao('unidades', 'inativar'),
    async (req, res) => {
        try {
            const { ids } = req.body;

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
// Proteção: Criar
router.get("/novo",
    verificarAutenticacao,
    verificarPermissao('unidades', 'criar'),
    (req, res) => {
        res.render("unidade/unidade-form", {
            user: req.session.user,
            currentPage: 'unidade-novo'
        });
    });

// --- Rota: Processar Cadastro ---
router.post("/salvar",
    verificarAutenticacao,
    verificarPermissao('unidades', 'criar'),
    async (req, res) => {
        try {
            // AGORA RECEBEMOS O CEP E LOGRADOURO AQUI
            const { nome_fantasia, razao_social, cnpj, cep, logradouro, cidade, estado } = req.body;

            if (!nome_fantasia || !cnpj) {
                return res.status(400).json({ success: false, message: "Dados incompletos." });
            }

            const id_unidade = uuidv4();

            // SQL ATUALIZADO COM AS NOVAS COLUNAS
            const sql = `
            INSERT INTO unidade (id_unidade, nome_fantasia, razao_social, cnpj, cep, logradouro, cidade, estado, ativo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

            await db.query(sql, [id_unidade, nome_fantasia, razao_social, cnpj, cep, logradouro, cidade, estado, 1]);

            return res.status(200).json({ success: true, message: "Unidade cadastrada!" });

        } catch (error) {
            console.error("Erro ao salvar:", error);
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ success: false, message: "CNPJ já cadastrado." });
            }
            return res.status(500).json({ success: false, message: "Erro ao salvar." });
        }
    });

// --- Rota: Tela de Edição ---
// Proteção: Editar
router.get("/editar/:id",
    verificarAutenticacao,
    verificarPermissao('unidades', 'editar'),
    async (req, res) => {
        try {
            const { id } = req.params;

            // Busca a unidade no banco pelo ID
            const [unidades] = await db.query("SELECT * FROM unidade WHERE id_unidade = ?", [id]);

            // Se não achar, volta pra lista
            if (unidades.length === 0) {
                return res.redirect('/unidade');
            }

            res.render("unidade/unidade-editar", {
                user: req.session.user,
                currentPage: 'unidade', // Mantém o menu "Unidades" aceso na sidebar
                unidade: unidades[0]    // Manda os dados da unidade pra tela
            });
        } catch (error) {
            console.error("Erro ao buscar unidade para edição:", error);
            res.status(500).send("Erro interno ao carregar a página de edição.");
        }
    });

// --- Rota: Processar Edição ---
router.post("/editar/:id",
    verificarAutenticacao,
    verificarPermissao('unidades', 'editar'),
    async (req, res) => {
        try {
            const { id } = req.params;
            // AGORA RECEBEMOS O CEP E LOGRADOURO AQUI
            const { nome_fantasia, razao_social, cnpj, cep, logradouro, cidade, estado } = req.body;

            if (!nome_fantasia || !cnpj) {
                return res.status(400).json({ success: false, message: "Dados incompletos." });
            }

            // SQL ATUALIZADO COM AS NOVAS COLUNAS
            const sql = `
                UPDATE unidade 
                SET nome_fantasia = ?, razao_social = ?, cnpj = ?, cep = ?, logradouro = ?, cidade = ?, estado = ?
                WHERE id_unidade = ?
            `;

            const [result] = await db.query(sql, [nome_fantasia, razao_social, cnpj, cep, logradouro, cidade, estado, id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: "Unidade não encontrada." });
            }

            return res.status(200).json({ success: true, message: "Unidade atualizada com sucesso!" });

        } catch (error) {
            console.error("Erro ao atualizar unidade:", error);
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ success: false, message: "CNPJ já cadastrado em outra unidade." });
            }
            return res.status(500).json({ success: false, message: "Erro interno ao atualizar." });
        }
    });

module.exports = router;