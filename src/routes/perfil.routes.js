const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require("../database/db");
const verificarAutenticacao = require("../middlewares/auth.middleware");

// -- LISTAR PERFIS (Igual Unidades: JSON oculto) --
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        // Busca perfis + contagem de usuários ativos
        const sql = `
            SELECT 
                p.id_perfil, 
                p.nome_perfil, 
                p.descricao, 
                p.ativo,
                COUNT(u.id_usuario) as total_usuarios
            FROM perfil p
            LEFT JOIN usuario u ON p.id_perfil = u.id_perfil AND u.ativo = 1
            GROUP BY p.id_perfil
            ORDER BY p.nome_perfil ASC
        `;

        // Nota: db.execute ou db.query funcionam, mas db.query é mais comum para mysql2 padrão
        const [perfis] = await db.query(sql);

        res.render("usuarios/perfil-lista", {
            user: req.session.user,
            currentPage: 'perfil',
            perfis: perfis,
            // TÉCNICA DO ELEMENTO OCULTO (Igual Unidades)
            perfisJson: JSON.stringify(perfis)
        });
    } catch (error) {
        console.error("Erro ao listar perfis:", error);
        res.status(500).send("Erro ao carregar perfis.");
    }
});

// -- NOVO PERFIL (Formulário) --
router.get("/novo", verificarAutenticacao, async (req, res) => {
    try {
        // CORREÇÃO DO ERRO SQL AQUI: Adicionado o * (asterisco)
        const [modulos] = await db.query("SELECT * FROM modulo_sistema ORDER BY nome_modulo ASC");

        res.render("usuarios/perfil-form", {
            user: req.session.user,
            modulos: modulos,
            currentPage: 'perfil-novo'
        });
    } catch (error) {
        console.error("Erro ao carregar formulário:", error);
        // Se der erro, redireciona para a lista para não travar a tela
        res.redirect('/perfil');
    }
});

// -- SALVAR PERFIL (POST) --
router.post("/novo", verificarAutenticacao, async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const { nome, descricao, permissoes } = req.body;

        if (!nome) {
            throw new Error("O nome do perfil é obrigatório.");
        }

        // 1. Inserir Perfil
        const idPerfil = uuidv4();
        await connection.query(
            "INSERT INTO perfil (id_perfil, nome_perfil, descricao, ativo) VALUES (?, ?, ?, ?)",
            [idPerfil, nome, descricao, 1]
        );

        // 2. Inserir Permissões
        if (permissoes) {
            for (const [idModulo, actions] of Object.entries(permissoes)) {
                const idPermissao = uuidv4();

                const podeVer = Number(actions.ver) || 0;
                const podeCriar = Number(actions.criar) || 0;
                const podeEditar = Number(actions.editar) || 0;
                const podeExcluir = Number(actions.excluir) || 0;
                const tudo = Number(actions.tudo) || 0;

                await connection.query(`
                    INSERT INTO perfil_permissao 
                    (id_permissao, id_perfil, id_modulo, pode_ver, pode_criar, pode_editar, pode_excluir, tudo)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [idPermissao, idPerfil, idModulo, podeVer, podeCriar, podeEditar, podeExcluir, tudo]);
            }
        }

        await connection.commit();
        res.json({ success: true, message: "Perfil criado com sucesso!" });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao salvar perfil:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Erro interno no servidor."
        });
    } finally {
        if (connection) connection.release();
    }
});

// -- INATIVAR MÚLTIPLOS (Igual Unidades) --
router.post("/inativar-multiplos", verificarAutenticacao, async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: "Nenhum ID recebido." });
        }

        const validIds = ids.map(id => String(id).trim()).filter(id => id.length > 0);

        if (validIds.length === 0) {
            return res.status(400).json({ success: false, message: "IDs inválidos." });
        }

        const placeholders = validIds.map(() => '?').join(',');
        const sql = `UPDATE perfil SET ativo = 0 WHERE id_perfil IN (${placeholders})`;

        const [result] = await db.query(sql, validIds);

        return res.status(200).json({
            success: true,
            message: `${result.affectedRows} perfil(is) inativado(s) com sucesso!`
        });

    } catch (error) {
        console.error("ERRO NO SERVIDOR:", error);
        return res.status(500).json({
            success: false,
            message: "Erro interno ao processar a solicitação."
        });
    }
});

module.exports = router;