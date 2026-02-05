const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require("../database/db");

// Middlewares e Utils
const verificarAutenticacao = require("../middlewares/auth.middleware");
const verificarPermissao = require("../middlewares/permission.middleware");
const registrarLog = require("../utils/logger"); // <--- IMPORTANTE

// Função auxiliar para verificar Admin (Bypass)
const verificarSeEhAdmin = (user) => {
    if (user.email === 'admin@admin.com') return true;
    if (user.nome_perfil === 'Administrador' || user.nome_perfil === 'Super Admin') return true;
    return false;
};

// -- LISTAR PERFIS --
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        // Verifica permissão manualmente se não usar o middleware na rota
        // Mas vamos deixar liberado a listagem básica, o front controla os botões

        const sql = `
            SELECT 
                p.id_perfil, p.nome_perfil, p.descricao, p.ativo,
                COUNT(u.id_usuario) as total_usuarios
            FROM perfil p
            LEFT JOIN usuario u ON p.id_perfil = u.id_perfil AND u.ativo = 1
            GROUP BY p.id_perfil
            ORDER BY p.nome_perfil ASC
        `;

        const [perfis] = await db.query(sql);

        res.render("usuarios/perfil-lista", {
            user: req.session.user,
            currentPage: 'perfil',
            perfis: perfis,
            perfisJson: JSON.stringify(perfis)
        });
    } catch (error) {
        console.error("Erro ao listar perfis:", error);
        res.status(500).send("Erro ao carregar perfis.");
    }
});

// -- TELA DE NOVO PERFIL --
router.get("/novo", verificarAutenticacao, verificarPermissao('perfis', 'pode_criar'), async (req, res) => {
    try {
        const [modulos] = await db.query("SELECT * FROM modulo_sistema ORDER BY nome_modulo ASC");
        res.render("usuarios/perfil-form", {
            user: req.session.user,
            modulos: modulos,
            currentPage: 'perfil-novo'
        });
    } catch (error) {
        console.error("Erro ao carregar formulário:", error);
        res.redirect('/perfil');
    }
});

// -- TELA DE EDITAR PERFIL --
router.get("/editar/:id", verificarAutenticacao, verificarPermissao('perfis', 'pode_editar'), async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Busca dados do Perfil
        const [rowsPerfil] = await db.query("SELECT * FROM perfil WHERE id_perfil = ?", [id]);
        if (rowsPerfil.length === 0) return res.status(404).send("Perfil não encontrado.");

        // 2. Busca Todos os Módulos (para montar a tabela)
        const [modulos] = await db.query("SELECT * FROM modulo_sistema ORDER BY nome_modulo ASC");

        // 3. Busca as Permissões JÁ EXISTENTES desse perfil
        const [permissoesAtuais] = await db.query("SELECT * FROM perfil_permissao WHERE id_perfil = ?", [id]);

        res.render("usuarios/perfil-editar", {
            user: req.session.user,
            currentPage: 'perfil',
            perfil: rowsPerfil[0],
            modulos: modulos,
            permissoes: permissoesAtuais // Passamos para o front marcar os checkboxes
        });

    } catch (error) {
        console.error("Erro ao abrir edição:", error);
        res.status(500).send("Erro ao carregar dados.");
    }
});

// -- SALVAR NOVO PERFIL (POST) --
router.post("/novo", verificarAutenticacao, verificarPermissao('perfis', 'pode_criar'), async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const { nome, descricao, permissoes } = req.body;
        const userLogado = req.session.user;

        if (!nome) throw new Error("O nome do perfil é obrigatório.");

        const idPerfil = uuidv4();
        await connection.query(
            "INSERT INTO perfil (id_perfil, nome_perfil, descricao, ativo) VALUES (?, ?, ?, ?)",
            [idPerfil, nome, descricao, 1]
        );

        if (permissoes) {
            for (const [idModulo, actions] of Object.entries(permissoes)) {
                const idPermissao = uuidv4();
                await connection.query(`
                    INSERT INTO perfil_permissao (id_permissao, id_perfil, id_modulo, pode_ver, pode_criar, pode_editar, pode_inativar, tudo)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    idPermissao, idPerfil, idModulo,
                    Number(actions.ver) || 0, Number(actions.criar) || 0, Number(actions.editar) || 0, Number(actions.inativar) || 0, Number(actions.tudo) || 0
                ]);
            }
        }

        await registrarLog({
            id_unidade: userLogado.id_unidade || userLogado.unidade_id,
            id_usuario: userLogado.id_usuario,
            acao: 'INSERT',
            tabela: 'perfil',
            id_registro: idPerfil,
            dados_novos: { nome, descricao }
        });

        await connection.commit();
        res.json({ success: true, message: "Perfil criado com sucesso!" });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao salvar perfil:", error);
        res.status(500).json({ success: false, message: error.message || "Erro interno." });
    } finally {
        if (connection) connection.release();
    }
});

// -- EDITAR PERFIL (POST) --
router.post("/editar", verificarAutenticacao, verificarPermissao('perfis', 'pode_editar'), async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const { id_perfil, nome, descricao, permissoes } = req.body;
        const userLogado = req.session.user;

        // Dados anteriores para Log
        const [oldData] = await connection.query("SELECT nome_perfil, descricao FROM perfil WHERE id_perfil = ?", [id_perfil]);

        // 1. Atualiza dados básicos
        await connection.query("UPDATE perfil SET nome_perfil = ?, descricao = ? WHERE id_perfil = ?", [nome, descricao, id_perfil]);

        // 2. Atualiza permissões (Remove todas antigas e recria as novas)
        await connection.query("DELETE FROM perfil_permissao WHERE id_perfil = ?", [id_perfil]);

        if (permissoes) {
            for (const [idModulo, actions] of Object.entries(permissoes)) {
                const idPermissao = uuidv4();
                await connection.query(`
                    INSERT INTO perfil_permissao (id_permissao, id_perfil, id_modulo, pode_ver, pode_criar, pode_editar, pode_inativar, tudo)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    idPermissao, id_perfil, idModulo,
                    Number(actions.ver) || 0, Number(actions.criar) || 0, Number(actions.editar) || 0, Number(actions.inativar) || 0, Number(actions.tudo) || 0
                ]);
            }
        }

        await registrarLog({
            id_unidade: userLogado.id_unidade || userLogado.unidade_id,
            id_usuario: userLogado.id_usuario,
            acao: 'UPDATE',
            tabela: 'perfil',
            id_registro: id_perfil,
            dados_anteriores: oldData[0],
            dados_novos: { nome, descricao }
        });

        await connection.commit();

        // =================================================================================
        // ATUALIZAÇÃO IMEDIATA DA SESSÃO (SE FOR O PRÓPRIO USUÁRIO)
        // =================================================================================
        if (userLogado.id_perfil === id_perfil) {

            // 1. Busca dados atualizados do perfil
            const [novoPerfil] = await db.query("SELECT * FROM perfil WHERE id_perfil = ?", [id_perfil]);

            // 2. Busca as novas permissões fazendo JOIN com modulo_sistema para pegar a 'chave_sistema' (ex: 'riscos', 'perfis')
            // Isso é CRUCIAL, pois a sessão usa a chave_sistema, não o ID.
            const [permsDb] = await db.query(`
                SELECT pp.*, m.chave_sistema 
                FROM perfil_permissao pp
                INNER JOIN modulo_sistema m ON pp.id_modulo = m.id_modulo
                WHERE pp.id_perfil = ?
            `, [id_perfil]);

            // 3. Reconstrói o objeto de permissões no formato que a sessão espera
            const novaListaPermissoes = {};
            permsDb.forEach(p => {
                novaListaPermissoes[p.chave_sistema] = {
                    // Mantemos compatibilidade com os dois formatos que usamos no sistema
                    ver: p.pode_ver,
                    criar: p.pode_criar,
                    editar: p.pode_editar,
                    inativar: p.pode_inativar,
                    tudo: p.tudo,

                    pode_ver: p.pode_ver,
                    pode_criar: p.pode_criar,
                    pode_editar: p.pode_editar,
                    pode_inativar: p.pode_inativar
                };
            });

            // 4. Atualiza a sessão em memória
            req.session.user.nome_perfil = novoPerfil[0].nome_perfil;
            req.session.user.permissoes = novaListaPermissoes;

            // 5. Força o salvamento antes de responder
            req.session.save();
        }
        // =================================================================================

        res.json({ success: true, message: "Perfil atualizado com sucesso!" });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao editar perfil:", error);
        res.status(500).json({ success: false, message: error.message || "Erro interno." });
    } finally {
        if (connection) connection.release();
    }
});

// -- INATIVAR MÚLTIPLOS --
router.post("/inativar-multiplos", verificarAutenticacao, verificarPermissao('perfis', 'pode_inativar'), async (req, res) => {
    try {
        const { ids } = req.body;
        const userLogado = req.session.user;

        if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: "Nenhum ID." });

        const validIds = ids.map(id => String(id).trim()).filter(id => id.length > 0);
        const placeholders = validIds.map(() => '?').join(',');

        const sql = `UPDATE perfil SET ativo = 0 WHERE id_perfil IN (${placeholders})`;
        const [result] = await db.query(sql, validIds);

        if (result.affectedRows > 0) {
            // Log para cada item
            const promisesLog = validIds.map(async (id) => {
                return registrarLog({
                    id_unidade: userLogado.id_unidade || userLogado.unidade_id,
                    id_usuario: userLogado.id_usuario,
                    acao: 'INATIVAR',
                    tabela: 'perfil',
                    id_registro: id,
                    dados_novos: { status: 'Inativo' }
                });
            });
            await Promise.all(promisesLog);
        }

        return res.status(200).json({ success: true, message: `${result.affectedRows} perfil(is) inativado(s).` });

    } catch (error) {
        console.error("ERRO:", error);
        return res.status(500).json({ success: false, message: "Erro interno." });
    }
});

module.exports = router;