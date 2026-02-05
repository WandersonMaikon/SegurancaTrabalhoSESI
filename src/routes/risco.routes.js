const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { v4: uuidv4 } = require('uuid');
const verificarAutenticacao = require("../middlewares/auth.middleware");
const verificarPermissao = require("../middlewares/permission.middleware");
const registrarLog = require("../utils/logger");

// Função auxiliar para verificar Admin
const verificarSeEhAdmin = (user) => {
    if (user.email === 'admin@admin.com') return true;
    if (user.nome_perfil === 'Administrador' || user.nome_perfil === 'Super Admin') return true;
    return false;
};

// --- LISTAR RISCOS ---
// Note: Listagem geralmente usa permissão 'ver'. Se quiser restringir, adicione verificarPermissao('riscos', 'pode_ver')
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
// CORREÇÃO: 'riscos' no plural
router.get("/novo", verificarAutenticacao, verificarPermissao('riscos', 'pode_criar'), (req, res) => {
    res.render("estoque/risco-form", { user: req.session.user, currentPage: 'risco-novo' });
});

// --- TELA DE EDITAR RISCO ---
// CORREÇÃO: 'riscos' no plural
router.get("/editar/:id", verificarAutenticacao, verificarPermissao('riscos', 'pode_editar'), async (req, res) => {
    try {
        const { id } = req.params;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        const query = `
            SELECT r.*, t24.codigo as codigo_esocial_visual 
            FROM risco r
            LEFT JOIN tabela_24_esocial t24 ON r.id_tabela_24 = t24.id_tabela_24
            WHERE r.id_risco = ? AND r.deleted_at IS NULL
        `;

        const [rows] = await db.query(query, [id]);

        if (rows.length === 0) return res.status(404).send("Risco não encontrado.");

        const risco = rows[0];

        if (risco.id_unidade === null && !ehAdmin) {
            return res.status(403).send("<h1>Acesso Negado</h1><p>Risco Global. Apenas administradores podem editar.</p><a href='/risco'>Voltar</a>");
        }

        if (risco.id_unidade && risco.id_unidade !== userLogado.id_unidade && !ehAdmin) {
            return res.status(403).send("Acesso negado a este registro.");
        }

        res.render("estoque/risco-editar", {
            user: userLogado,
            currentPage: 'risco',
            risco: risco
        });

    } catch (error) {
        console.error("Erro ao abrir edição:", error);
        res.status(500).send("Erro ao carregar dados.");
    }
});

// --- API: BUSCAR DADOS DO ESOCIAL ---
router.get("/buscar-esocial/:codigo", verificarAutenticacao, async (req, res) => {
    try {
        const { codigo } = req.params;
        const [rows] = await db.query("SELECT id_tabela_24, grupo, descricao FROM tabela_24_esocial WHERE codigo = ?", [codigo]);
        if (rows.length > 0) return res.json({ success: true, data: rows[0] });
        else return res.json({ success: false, message: "Código não encontrado." });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Erro no servidor." });
    }
});

// --- SALVAR NOVO RISCO ---
// CORREÇÃO: 'riscos' no plural
router.post("/novo", verificarAutenticacao, verificarPermissao('riscos', 'pode_criar'), async (req, res) => {
    try {
        const { id_tabela_24, nome_risco, tipo_risco } = req.body;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        if (!nome_risco || !tipo_risco) return res.status(400).json({ success: false, message: "Campos obrigatórios faltando." });

        const idTabela = id_tabela_24 ? id_tabela_24 : null;
        let idUnidadeParaSalvar = ehAdmin ? null : (userLogado.id_unidade || userLogado.unidade_id);

        const [result] = await db.query(`
            INSERT INTO risco (id_unidade, id_tabela_24, nome_risco, tipo_risco) VALUES (?, ?, ?, ?)
        `, [idUnidadeParaSalvar, idTabela, nome_risco, tipo_risco]);

        await registrarLog({
            id_unidade: userLogado.id_unidade || userLogado.unidade_id,
            id_usuario: userLogado.id_usuario,
            acao: 'INSERT',
            tabela: 'risco',
            id_registro: result.insertId,
            dados_novos: { nome: nome_risco, tipo: tipo_risco, esocial: idTabela ? 'Sim' : 'Não' }
        });

        return res.json({ success: true, message: "Risco cadastrado com sucesso!" });

    } catch (error) {
        console.error("Erro ao salvar risco:", error);
        return res.status(500).json({ success: false, message: "Erro ao salvar risco." });
    }
});

// --- EDITAR RISCO ---
// CORREÇÃO: 'riscos' no plural
router.post("/editar", verificarAutenticacao, verificarPermissao('riscos', 'pode_editar'), async (req, res) => {
    try {
        const { id_risco, nome_risco, tipo_risco, id_tabela_24 } = req.body;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        const [rows] = await db.query("SELECT * FROM risco WHERE id_risco = ?", [id_risco]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: "Risco não encontrado." });
        const riscoAtual = rows[0];

        if (riscoAtual.id_unidade === null && !ehAdmin) return res.status(403).json({ success: false, message: "Você não tem permissão para editar riscos globais." });
        if (riscoAtual.id_unidade && riscoAtual.id_unidade !== userLogado.id_unidade && !ehAdmin) return res.status(403).json({ success: false, message: "Acesso negado." });

        const idTabela = id_tabela_24 ? id_tabela_24 : null;

        await db.query(`
            UPDATE risco SET nome_risco = ?, tipo_risco = ?, id_tabela_24 = ? WHERE id_risco = ?
        `, [nome_risco, tipo_risco, idTabela, id_risco]);

        await registrarLog({
            id_unidade: userLogado.id_unidade || userLogado.unidade_id,
            id_usuario: userLogado.id_usuario,
            acao: 'UPDATE',
            tabela: 'risco',
            id_registro: id_risco,
            dados_anteriores: { nome: riscoAtual.nome_risco, tipo: riscoAtual.tipo_risco },
            dados_novos: { nome: nome_risco, tipo: tipo_risco }
        });

        return res.json({ success: true, message: "Risco atualizado com sucesso!" });

    } catch (error) {
        console.error("Erro ao editar risco:", error);
        return res.status(500).json({ success: false, message: "Erro ao atualizar risco." });
    }
});

// --- INATIVAR MÚLTIPLOS ---
// CORREÇÃO: 'riscos' no plural
router.post("/inativar-multiplos", verificarAutenticacao, verificarPermissao('riscos', 'pode_inativar'), async (req, res) => {
    try {
        const { ids } = req.body;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);
        const idUnidadeUsuario = userLogado.id_unidade || userLogado.unidade_id;

        if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: "Nenhum registro selecionado." });

        const validIds = ids.map(id => String(id).trim()).filter(id => id.length > 0);
        if (validIds.length === 0) return res.status(400).json({ success: false, message: "IDs inválidos." });

        let sql = `UPDATE risco SET deleted_at = NOW() WHERE id_risco IN (${validIds.map(() => '?').join(',')})`;
        const params = [...validIds];

        if (!ehAdmin) {
            sql += ` AND id_unidade = ?`;
            params.push(idUnidadeUsuario);
        }

        const [result] = await db.query(sql, params);

        if (result.affectedRows === 0) return res.json({ success: false, message: "Nenhum registro pôde ser excluído." });

        const promisesLog = validIds.map(async (idRisco) => {
            return registrarLog({
                id_unidade: idUnidadeUsuario,
                id_usuario: userLogado.id_usuario,
                acao: 'INATIVAR',
                tabela: 'risco',
                id_registro: idRisco,
                dados_novos: { status: 'Inativo/Excluído' }
            });
        });
        await Promise.all(promisesLog);

        return res.json({ success: true, message: "Operação concluída." });
    } catch (error) {
        console.error("Erro ao inativar riscos:", error);
        return res.status(500).json({ success: false, message: "Erro interno." });
    }
});

module.exports = router;