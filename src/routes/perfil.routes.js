const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require("../database/db");
const verificarAutenticacao = require("../middlewares/auth.middleware");

// -- LISTAR PERFIS --
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        const sql = `
            SELECT p.id_perfil, p.nome_perfil, p.descricao, COUNT(u.id_usuario) as total_usuarios
            FROM perfil p
            LEFT JOIN usuario u ON p.id_perfil = u.id_perfil AND u.ativo = 1
            WHERE p.ativo = 1
            GROUP BY p.id_perfil
            ORDER BY p.nome_perfil ASC
        `;
        const [perfis] = await db.execute(sql);

        res.render("usuarios/perfil-lista", {
            user: req.session.user,
            perfis: perfis,
            currentPage: 'perfil'
        });
    } catch (error) {
        console.error("Erro ao listar perfis:", error);
        res.status(500).send("Erro ao carregar perfis.");
    }
});

// -- NOVO PERFIL (Formulário) --
router.get("/novo", verificarAutenticacao, async (req, res) => {
    try {
        const [modulos] = await db.execute("SELECT * FROM modulo_sistema ORDER BY nome_modulo ASC");

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
            "INSERT INTO perfil (id_perfil, nome_perfil, descricao) VALUES (?, ?, ?)",
            [idPerfil, nome, descricao]
        );

        // 2. Inserir Permissões
        if (permissoes) {
            for (const [idModulo, actions] of Object.entries(permissoes)) {
                const idPermissao = uuidv4();

                // Converte inputs para 0 ou 1
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

module.exports = router;