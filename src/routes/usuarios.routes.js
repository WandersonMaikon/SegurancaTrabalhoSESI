const express = require("express");
const router = express.Router();
const db = require("../database/db");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const verificarAutenticacao = require("../middlewares/auth.middleware");

// -- LISTAR USUÁRIOS --
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        const query = `
            SELECT u.id_usuario, u.nome_completo, u.email, u.ativo, 
                   p.nome_perfil, un.nome_fantasia as nome_unidade
            FROM usuario u
            LEFT JOIN perfil p ON u.id_perfil = p.id_perfil
            LEFT JOIN unidade un ON u.id_unidade = un.id_unidade
            where p.nome_perfil <> 'Administrador'
            ORDER BY u.nome_completo ASC
        `;
        const [usuarios] = await db.query(query);

        res.render("usuarios/usuario-lista", {
            user: req.session.user,
            usuariosJson: JSON.stringify(usuarios),
            currentPage: 'usuarios'
        });
    } catch (error) {
        console.error("Erro ao listar usuários:", error);
        res.status(500).send("Erro ao carregar usuários.");
    }
});

// -- FORMULÁRIO DE NOVO USUÁRIO (GET) --
router.get("/novo", verificarAutenticacao, async (req, res) => {
    try {
        // 1. Busca Perfis Ativos
        const [perfis] = await db.query("SELECT id_perfil, nome_perfil FROM perfil WHERE ativo = 1 and nome_perfil <> 'Administrador' ORDER BY nome_perfil ASC");

        // 2. Identificar Perfil Real do Usuário Logado
        const idUsuario = req.session.user.id_usuario || req.session.user.id || req.session.user.uuid;
        const emailUsuario = req.session.user.email;
        let dadosUsuario = [];

        if (idUsuario) {
            [dadosUsuario] = await db.query(`
                SELECT p.nome_perfil 
                FROM usuario u
                JOIN perfil p ON u.id_perfil = p.id_perfil
                WHERE u.id_usuario = ?
            `, [idUsuario]);
        }

        if ((!dadosUsuario || dadosUsuario.length === 0) && emailUsuario) {
            [dadosUsuario] = await db.query(`
                SELECT p.nome_perfil 
                FROM usuario u
                JOIN perfil p ON u.id_perfil = p.id_perfil
                WHERE u.email = ?
            `, [emailUsuario]);
        }

        const nomePerfilAtual = dadosUsuario[0]?.nome_perfil || "";

        // 3. Buscar Unidades (Apenas se for Admin)
        let unidades = [];
        const ehAdmin = nomePerfilAtual.trim().toLowerCase() === 'administrador' ||
            nomePerfilAtual.trim().toLowerCase() === 'super admin';

        if (ehAdmin) {
            // Busca apenas unidades ativas
            const [rows] = await db.query("SELECT id_unidade, nome_fantasia, cidade FROM unidade WHERE ativo = 1 ORDER BY nome_fantasia ASC");
            unidades = rows;
        }

        res.render("usuarios/usuario-form", {
            user: req.session.user,
            perfis: perfis,
            unidades: unidades,
            currentPage: 'usuario-novo'
        });

    } catch (error) {
        console.error("Erro ao carregar formulário:", error);
        res.redirect('/usuario');
    }
});

// -- SALVAR NOVO USUÁRIO (POST) --
router.post("/novo", verificarAutenticacao, async (req, res) => {
    let connection;
    try {
        const { nome, email, perfil, unidade } = req.body;

        if (!nome || !email || !perfil) {
            return res.status(400).json({ success: false, message: "Preencha nome, email e perfil." });
        }

        connection = await db.getConnection();

        // 1. Verificar se E-mail já existe
        const [existing] = await connection.query("SELECT id_usuario FROM usuario WHERE email = ?", [email]);
        if (existing.length > 0) {
            connection.release();
            return res.status(400).json({ success: false, message: "Este e-mail já está cadastrado." });
        }

        // 2. Definir a Unidade
        let idUnidadeFinal = null;

        if (unidade && unidade.trim() !== "") {
            // Admin selecionou manualmente
            idUnidadeFinal = unidade;
        } else {
            // Usuário comum: Herda a unidade da sessão
            idUnidadeFinal = req.session.user.id_unidade || req.session.user.unidade_id;
        }

        if (!idUnidadeFinal) {
            connection.release();
            return res.status(400).json({ success: false, message: "Erro: Não foi possível identificar a unidade do usuário logado." });
        }

        // 3. Criptografia e Insert
        const senhaPadrao = "mudar123";
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(senhaPadrao, salt);
        const idUsuario = uuidv4();

        const sqlInsert = `
            INSERT INTO usuario 
            (id_usuario, id_unidade, nome_completo, email, senha_hash, id_perfil, ativo) 
            VALUES (?, ?, ?, ?, ?, ?, 1)
        `;

        await connection.query(sqlInsert, [
            idUsuario,
            idUnidadeFinal,
            nome,
            email,
            senhaHash,
            perfil
        ]);

        res.json({ success: true, message: "Usuário criado com sucesso!" });

    } catch (error) {
        console.error("ERRO AO SALVAR USUÁRIO:", error);
        res.status(500).json({ success: false, message: "Erro interno: " + error.message });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;