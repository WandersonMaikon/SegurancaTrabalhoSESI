const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { v4: uuidv4 } = require("uuid");

const verificarAutenticacao = require("../middlewares/auth.middleware");
const verificarPermissao = require("../middlewares/permission.middleware");
const registrarLog = require("../utils/logger"); // IMPORTANTE: O Logger

// Função auxiliar para verificar se é Admin
const verificarSeEhAdmin = (user) => {
    if (user.email === 'admin@admin.com') return true;
    if (user.nome_perfil === 'Administrador' || user.nome_perfil === 'Super Admin') return true;
    return false;
};

// --- LISTAR SERVIÇOS ---
router.get("/", verificarAutenticacao, verificarPermissao('servicos', 'ver'), async (req, res) => {
    try {
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        let query = `
            SELECT s.id_servico, s.nome_servico, s.descricao, s.ativo, s.id_unidade,
                   u.nome_fantasia as nome_unidade
            FROM servico s
            LEFT JOIN unidade u ON s.id_unidade = u.id_unidade
            WHERE s.deleted_at IS NULL
        `;

        const params = [];

        if (!ehAdmin) {
            query += ` AND s.id_unidade = ?`;
            params.push(userLogado.id_unidade || userLogado.unidade_id);
        }

        query += ` ORDER BY s.nome_servico ASC`;

        const [servicos] = await db.query(query, params);

        res.render("servicos/servico-lista", {
            user: req.session.user,
            currentPage: 'servicos',
            servicosJson: JSON.stringify(servicos)
        });

    } catch (error) {
        console.error("Erro ao listar serviços:", error);
        res.status(500).send("Erro ao carregar serviços.");
    }
});

// --- TELA DE NOVO SERVIÇO ---
router.get("/novo", verificarAutenticacao, verificarPermissao('servicos', 'criar'), async (req, res) => {
    try {
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        let sqlUsers = `
            SELECT u.id_usuario, u.nome_completo 
            FROM usuario u
            JOIN perfil p ON u.id_perfil = p.id_perfil
            WHERE u.ativo = 1 AND p.nome_perfil NOT IN ('Administrador', 'Super Admin')
        `;

        const paramsUsers = [];
        if (!ehAdmin) {
            sqlUsers += ` AND u.id_unidade = ?`;
            paramsUsers.push(userLogado.id_unidade || userLogado.unidade_id);
        }
        sqlUsers += ` ORDER BY u.nome_completo ASC`;

        const [usuarios] = await db.query(sqlUsers, paramsUsers);

        res.render("servicos/servico-form", {
            user: req.session.user,
            usuarios: usuarios,
            currentPage: 'servicos'
        });

    } catch (error) {
        console.error("Erro ao carregar form:", error);
        res.redirect('/servicos');
    }
});

// --- SALVAR NOVO SERVIÇO ---
router.post("/novo", verificarAutenticacao, verificarPermissao('servicos', 'criar'), async (req, res) => {
    let connection;
    try {
        const { nome_servico, descricao, responsaveis } = req.body;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        if (!nome_servico) return res.status(400).json({ success: false, message: "Nome obrigatório." });

        connection = await db.getConnection();
        await connection.beginTransaction();

        let idUnidadeFinal = ehAdmin ? null : (userLogado.id_unidade || userLogado.unidade_id);
        const idServico = uuidv4();

        // 1. Insert Serviço
        await connection.query(
            `INSERT INTO servico (id_servico, id_unidade, nome_servico, descricao, ativo) VALUES (?, ?, ?, ?, 1)`,
            [idServico, idUnidadeFinal, nome_servico, descricao]
        );

        // 2. Insert Responsáveis
        if (responsaveis) {
            const listaIds = Array.isArray(responsaveis) ? responsaveis : [responsaveis];
            for (const idUsuario of listaIds) {
                await connection.query(
                    `INSERT INTO servico_responsavel (id_servico, id_usuario) VALUES (?, ?)`,
                    [idServico, idUsuario]
                );
            }
        }

        await connection.commit();

        // 3. LOG (Fora da transação para não bloquear)
        await registrarLog({
            id_unidade: userLogado.id_unidade || userLogado.unidade_id,
            id_usuario: userLogado.id_usuario,
            acao: 'INSERT',
            tabela: 'servico',
            id_registro: idServico,
            dados_novos: { nome: nome_servico, descricao: descricao, responsaveis_qtd: responsaveis ? responsaveis.length : 0 }
        });

        res.json({ success: true, message: "Serviço cadastrado com sucesso!" });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao salvar serviço:", error);
        res.status(500).json({ success: false, message: "Erro interno." });
    } finally {
        if (connection) connection.release();
    }
});

// --- TELA DE EDITAR (GET) ---
router.get("/editar/:id", verificarAutenticacao, verificarPermissao('servicos', 'editar'), async (req, res) => {
    try {
        const { id } = req.params;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        // 1. Busca Serviço
        const [rows] = await db.query("SELECT * FROM servico WHERE id_servico = ? AND deleted_at IS NULL", [id]);
        if (rows.length === 0) return res.status(404).send("Serviço não encontrado.");
        const servico = rows[0];

        // 2. Validação de Unidade
        if (!ehAdmin && servico.id_unidade !== (userLogado.id_unidade || userLogado.unidade_id)) {
            return res.status(403).send("Acesso negado.");
        }

        // 3. Busca Usuários (Responsáveis Disponíveis)
        let sqlUsers = `
            SELECT u.id_usuario, u.nome_completo 
            FROM usuario u
            JOIN perfil p ON u.id_perfil = p.id_perfil
            WHERE u.ativo = 1 AND p.nome_perfil NOT IN ('Administrador', 'Super Admin')
        `;
        const paramsUsers = [];
        if (!ehAdmin) {
            sqlUsers += ` AND u.id_unidade = ?`;
            paramsUsers.push(userLogado.id_unidade || userLogado.unidade_id);
        }
        sqlUsers += ` ORDER BY u.nome_completo ASC`;
        const [usuarios] = await db.query(sqlUsers, paramsUsers);

        // 4. Busca Responsáveis JÁ Selecionados
        const [respRows] = await db.query("SELECT id_usuario FROM servico_responsavel WHERE id_servico = ?", [id]);
        const idsSelecionados = respRows.map(r => r.id_usuario); // Array de IDs

        res.render("servicos/servico-editar", {
            user: userLogado,
            currentPage: 'servicos',
            servico: servico,
            usuarios: usuarios,
            selecionados: idsSelecionados
        });

    } catch (error) {
        console.error("Erro ao abrir edição:", error);
        res.status(500).send("Erro interno.");
    }
});

// --- TELA DE VER (GET) ---
router.get("/ver/:id", verificarAutenticacao, verificarPermissao('servicos', 'ver'), async (req, res) => {
    try {
        const { id } = req.params;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        // Busca Serviço + Nome Unidade
        const [rows] = await db.query(`
            SELECT s.*, u.nome_fantasia as nome_unidade 
            FROM servico s
            LEFT JOIN unidade u ON s.id_unidade = u.id_unidade
            WHERE s.id_servico = ? AND s.deleted_at IS NULL
        `, [id]);

        if (rows.length === 0) return res.status(404).send("Serviço não encontrado.");
        const servico = rows[0];

        if (!ehAdmin && servico.id_unidade !== (userLogado.id_unidade || userLogado.unidade_id)) {
            return res.status(403).send("Acesso negado.");
        }

        // Busca nomes dos responsáveis
        const [responsaveis] = await db.query(`
            SELECT u.nome_completo 
            FROM servico_responsavel sr
            JOIN usuario u ON sr.id_usuario = u.id_usuario
            WHERE sr.id_servico = ?
        `, [id]);

        res.render("servicos/servico-ver", {
            user: userLogado,
            currentPage: 'servicos',
            servico: servico,
            listaResponsaveis: responsaveis
        });

    } catch (error) {
        console.error("Erro ao ver serviço:", error);
        res.status(500).send("Erro interno.");
    }
});

// --- AÇÃO EDITAR (POST) ---
router.post("/editar", verificarAutenticacao, verificarPermissao('servicos', 'editar'), async (req, res) => {
    let connection;
    try {
        const { id_servico, nome_servico, descricao, responsaveis } = req.body;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Busca dados do SERVIÇO ANTERIOR
        const [rows] = await connection.query("SELECT * FROM servico WHERE id_servico = ?", [id_servico]);
        if (rows.length === 0) { await connection.rollback(); return res.status(404).json({ success: false, message: "Não encontrado." }); }
        const servicoAnterior = rows[0];

        // Validação de Permissão de Unidade
        if (!ehAdmin && servicoAnterior.id_unidade !== (userLogado.id_unidade || userLogado.unidade_id)) {
            await connection.rollback();
            return res.status(403).json({ success: false, message: "Sem permissão." });
        }

        // =================================================================================
        // 1.1. BUSCAR NOMES DOS RESPONSÁVEIS ANTERIORES (Para o Log "DE")
        // =================================================================================
        const [oldRespRows] = await connection.query(`
            SELECT u.nome_completo 
            FROM servico_responsavel sr
            JOIN usuario u ON sr.id_usuario = u.id_usuario
            WHERE sr.id_servico = ? 
            ORDER BY u.nome_completo ASC
        `, [id_servico]);

        // Cria uma string ex: "João Silva, Maria Souza"
        const nomesAnterioresStr = oldRespRows.map(u => u.nome_completo).join(", ");

        // =================================================================================
        // 2. ATUALIZAÇÕES NO BANCO
        // =================================================================================

        // 2.1 Atualiza Tabela Principal
        await connection.query(
            `UPDATE servico SET nome_servico = ?, descricao = ? WHERE id_servico = ?`,
            [nome_servico, descricao, id_servico]
        );

        // 2.2 Atualiza Responsáveis (Remove tudo e insere de novo)
        await connection.query("DELETE FROM servico_responsavel WHERE id_servico = ?", [id_servico]);

        // Normaliza o array de responsáveis (pode vir string, array ou undefined)
        let listaIdsNovos = [];
        if (responsaveis) {
            listaIdsNovos = Array.isArray(responsaveis) ? responsaveis : [responsaveis];
        }

        // Insere os novos
        for (const idUsuario of listaIdsNovos) {
            await connection.query(
                `INSERT INTO servico_responsavel (id_servico, id_usuario) VALUES (?, ?)`,
                [id_servico, idUsuario]
            );
        }

        // =================================================================================
        // 3. BUSCAR NOMES DOS NOVOS RESPONSÁVEIS (Para o Log "PARA")
        // =================================================================================
        let nomesNovosStr = "";
        if (listaIdsNovos.length > 0) {
            // Buscamos os nomes baseados nos IDs que acabamos de receber do formulário
            // O "?" no IN (?) expande o array automaticamente na lib mysql2
            const [newRespRows] = await connection.query(`
                SELECT nome_completo FROM usuario WHERE id_usuario IN (?) ORDER BY nome_completo ASC
            `, [listaIdsNovos]);

            nomesNovosStr = newRespRows.map(u => u.nome_completo).join(", ");
        }

        await connection.commit();

        // =================================================================================
        // 4. LOG DE ATIVIDADE DETALHADO
        // =================================================================================
        const alteracoes = {};
        const mudou = (v1, v2) => (v1 || "").toString().trim() !== (v2 || "").toString().trim();

        // Compara Nome
        if (mudou(servicoAnterior.nome_servico, nome_servico)) {
            alteracoes.nome = { de: servicoAnterior.nome_servico, para: nome_servico };
        }

        // Compara Descrição
        if (mudou(servicoAnterior.descricao, descricao)) {
            alteracoes.descricao = { de: servicoAnterior.descricao, para: descricao };
        }

        // Compara Responsáveis (String vs String)
        // Ex: De "João" Para "João, Marcos"
        if (nomesAnterioresStr !== nomesNovosStr) {
            alteracoes.responsaveis = {
                de: nomesAnterioresStr || "Ninguém",
                para: nomesNovosStr || "Ninguém"
            };
        }

        if (Object.keys(alteracoes).length > 0) {
            await registrarLog({
                id_unidade: userLogado.id_unidade || userLogado.unidade_id,
                id_usuario: userLogado.id_usuario,
                acao: 'UPDATE',
                tabela: 'servico',
                id_registro: id_servico,
                dados_novos: alteracoes
            });
        }

        return res.json({ success: true, message: "Serviço atualizado!" });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao editar serviço:", error);
        return res.status(500).json({ success: false, message: "Erro ao editar." });
    } finally {
        if (connection) connection.release();
    }
});

// --- INATIVAR ---
router.post("/inativar-multiplos", verificarAutenticacao, verificarPermissao('servicos', 'inativar'), async (req, res) => {
    try {
        const { ids } = req.body;
        const userLogado = req.session.user;

        if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: "Nenhum ID." });
        const validIds = ids.map(id => String(id).trim()).filter(id => id.length > 0);
        const placeholders = validIds.map(() => '?').join(',');

        const sql = `UPDATE servico SET ativo = 0 WHERE id_servico IN (${placeholders})`;
        const [result] = await db.query(sql, validIds);

        // LOG EM MASSA
        if (result.affectedRows > 0) {
            const promisesLog = validIds.map(async (idServ) => {
                return registrarLog({
                    id_unidade: userLogado.id_unidade || userLogado.unidade_id,
                    id_usuario: userLogado.id_usuario,
                    acao: 'INATIVAR',
                    tabela: 'servico',
                    id_registro: idServ,
                    dados_novos: { status: 'Inativo' }
                });
            });
            await Promise.all(promisesLog);
        }

        return res.json({ success: true, message: "Serviços inativados." });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Erro interno." });
    }
});

module.exports = router;