const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { v4: uuidv4 } = require('uuid');
const verificarAutenticacao = require("../middlewares/auth.middleware");
const registrarLog = require("../utils/logger");

// Função auxiliar para verificar Admin
const verificarSeEhAdmin = (user) => {
    if (user.email === 'admin@admin.com') return true;
    if (user.nome_perfil === 'Administrador' || user.nome_perfil === 'Super Admin') return true;
    return false;
};

// --- LISTAR RISCOS ---
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

        if (!ehAdmin) {
            query += ` AND (r.id_unidade IS NULL OR r.id_unidade = ?)`;
            params.push(idUnidadeUsuario);
        }

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

// --- API: BUSCAR DADOS DO ESOCIAL ---
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

// --- SALVAR NOVO RISCO (COM LOG) ---
router.post("/novo", verificarAutenticacao, async (req, res) => {
    try {
        const { id_tabela_24, nome_risco, tipo_risco } = req.body;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        if (!nome_risco || !tipo_risco) {
            return res.status(400).json({ success: false, message: "Campos obrigatórios faltando." });
        }

        const idTabela = id_tabela_24 ? id_tabela_24 : null;
        let idUnidadeParaSalvar = ehAdmin ? null : (userLogado.id_unidade || userLogado.unidade_id);

        // 2. MUDANÇA: Usamos const [result] para pegar o ID gerado
        const [result] = await db.query(`
            INSERT INTO risco (id_unidade, id_tabela_24, nome_risco, tipo_risco)
            VALUES (?, ?, ?, ?)
        `, [idUnidadeParaSalvar, idTabela, nome_risco, tipo_risco]);

        // ============================================================
        // 3. REGISTRAR LOG (O insertId pega o ID do auto_increment)
        // ============================================================
        await registrarLog({
            id_unidade: userLogado.id_unidade || userLogado.unidade_id,
            id_usuario: userLogado.id_usuario,
            acao: 'INSERT',
            tabela: 'risco',
            id_registro: result.insertId, // ID do risco recém criado
            dados_novos: {
                nome: nome_risco,
                tipo: tipo_risco,
                esocial: idTabela ? 'Sim' : 'Não'
            }
        });
        // ============================================================

        return res.json({ success: true, message: "Risco cadastrado com sucesso!" });

    } catch (error) {
        console.error("Erro ao salvar risco:", error);
        return res.status(500).json({ success: false, message: "Erro ao salvar risco." });
    }
});

// --- INATIVAR MÚLTIPLOS RISCOS (COM LOG) ---
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

        let sql = `UPDATE risco SET deleted_at = NOW() WHERE id_risco IN (${validIds.map(() => '?').join(',')})`;
        const params = [...validIds];

        if (!ehAdmin) {
            sql += ` AND id_unidade = ?`;
            params.push(idUnidadeUsuario);
        }

        await db.query(sql, params);

        // ============================================================
        // 4. REGISTRAR LOG (Loop para registrar cada exclusão)
        // ============================================================
        // Fazemos isso de forma assíncrona sem travar a resposta para o usuário (fire and forget)
        // ou usamos Promise.all para garantir. Aqui vou usar Promise.all para ser seguro.

        const promisesLog = validIds.map(async (idRisco) => {
            return registrarLog({
                id_unidade: idUnidadeUsuario,
                id_usuario: userLogado.id_usuario,
                acao: 'INATIVAR', // Ou 'DELETE'
                tabela: 'risco',
                id_registro: idRisco,
                dados_novos: { status: 'Inativo/Excluído' }
            });
        });

        await Promise.all(promisesLog);
        // ============================================================

        return res.json({ success: true, message: "Operação concluída." });
    } catch (error) {
        console.error("Erro ao inativar riscos:", error);
        return res.status(500).json({ success: false, message: "Erro interno ao inativar riscos." });
    }
});

module.exports = router;