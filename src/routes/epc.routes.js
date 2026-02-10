const express = require("express");
const router = express.Router();
const db = require("../database/db");
const verificarAutenticacao = require("../middlewares/auth.middleware");
const verificarPermissao = require("../middlewares/permission.middleware");
const registrarLog = require("../utils/logger");

// --- 1. LISTAR EPCs (GET) ---
// Baseado no seu EPI: usa 'epcs' (plural) e filtra por ativo = 1
router.get("/", verificarAutenticacao, verificarPermissao('epcs', 'ver'), async (req, res) => {
    try {
        const userLogado = req.session.user;

        // Query simples e direta, igual ao EPI, sem buscar deleted_at
        let query = `SELECT * FROM epc WHERE ativo = 1 ORDER BY nome ASC`;

        const [epcs] = await db.query(query);

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

// --- 2. TELA DE NOVO (GET) ---
// Se o middleware bloquear aqui, ele redireciona para /epc?alert=sem_permissao
router.get("/novo", verificarAutenticacao, verificarPermissao('epcs', 'criar'), (req, res) => {
    res.render("estoque/epc-form", { user: req.session.user, currentPage: 'epc' });
});

// --- 3. TELA DE EDITAR (GET) ---
// Adicionado para permitir edição (padrão EPC), seguindo a lógica do EPI
router.get("/editar/:id", verificarAutenticacao, verificarPermissao('epcs', 'editar'), async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query("SELECT * FROM epc WHERE id_epc = ?", [id]);
        
        if (rows.length === 0) return res.status(404).send("EPC não encontrado.");

        res.render("estoque/epc-editar", {
            user: req.session.user,
            currentPage: 'epc',
            epc: rows[0]
        });
    } catch (error) {
        res.redirect('/epc');
    }
});

// --- 4. SALVAR NOVO (POST) ---
router.post("/novo", verificarAutenticacao, verificarPermissao('epcs', 'criar'), async (req, res) => {
    try {
        const { nome, observacoes } = req.body;
        const userLogado = req.session.user;

        if (!nome) return res.status(400).json({ success: false, message: "Nome é obrigatório." });

        // Inserção simples, definindo ativo = 1
        const [result] = await db.query(
            `INSERT INTO epc (nome, observacoes, ativo) VALUES (?, ?, 1)`,
            [nome, observacoes]
        );

        await registrarLog({
            id_unidade: userLogado.id_unidade || userLogado.unidade_id,
            id_usuario: userLogado.id_usuario,
            acao: 'INSERT',
            tabela: 'epc',
            id_registro: result.insertId,
            dados_novos: { nome, observacoes }
        });

        return res.json({ success: true, message: "EPC cadastrado com sucesso!" });

    } catch (error) {
        console.error("Erro ao salvar EPC:", error);
        return res.status(500).json({ success: false, message: "Erro interno." });
    }
});

// --- 5. SALVAR EDIÇÃO (POST) ---
router.post("/editar", verificarAutenticacao, verificarPermissao('epcs', 'editar'), async (req, res) => {
    try {
        const { id_epc, nome, observacoes, ativo } = req.body;
        const userLogado = req.session.user;

        const [rows] = await db.query("SELECT * FROM epc WHERE id_epc = ?", [id_epc]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: "EPC não encontrado." });

        // Update simples
        await db.query(
            `UPDATE epc SET nome = ?, observacoes = ?, ativo = ? WHERE id_epc = ?`,
            [nome, observacoes, ativo, id_epc]
        );

        await registrarLog({
            id_unidade: userLogado.id_unidade || userLogado.unidade_id,
            id_usuario: userLogado.id_usuario,
            acao: 'UPDATE',
            tabela: 'epc',
            id_registro: id_epc,
            dados_novos: { nome, observacoes, ativo }
        });

        return res.json({ success: true, message: "EPC atualizado com sucesso!" });

    } catch (error) {
        console.error("Erro ao editar EPC:", error);
        return res.status(500).json({ success: false, message: "Erro interno." });
    }
});

// --- 6. INATIVAR MÚLTIPLOS (POST) ---
// Igual ao EPI: Se o middleware bloquear, retorna JSON 403 e o SweetAlert exibe o erro
router.post("/inativar-multiplos", verificarAutenticacao, verificarPermissao('epcs', 'inativar'), async (req, res) => {
    try {
        const { ids } = req.body;
        const userLogado = req.session.user;

        if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: "Nada selecionado." });

        const validIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));
        if (validIds.length === 0) return res.status(400).json({ success: false, message: "IDs inválidos." });

        const placeholders = validIds.map(() => '?').join(',');

        // 1. Busca nomes para o Log
        const [epcsParaLog] = await db.query(`SELECT id_epc, nome FROM epc WHERE id_epc IN (${placeholders})`, validIds);

        // 2. Inativa (Update ativo = 0) - SEM DELETED_AT
        await db.query(`UPDATE epc SET ativo = 0 WHERE id_epc IN (${placeholders})`, validIds);

        // 3. Registra Log
        const promises = epcsParaLog.map(async (epc) => {
            return registrarLog({
                id_unidade: userLogado.id_unidade || userLogado.unidade_id,
                id_usuario: userLogado.id_usuario,
                acao: 'INATIVAR',
                tabela: 'epc',
                id_registro: epc.id_epc,
                dados_novos: { nome: epc.nome, status: 'Inativo' }
            });
        });
        await Promise.all(promises);

        return res.json({ success: true, message: "EPCs inativados." });

    } catch (error) {
        console.error("Erro inativar EPC:", error);
        return res.status(500).json({ success: false, message: "Erro interno." });
    }
});

module.exports = router;