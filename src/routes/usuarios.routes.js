const express = require("express");
const router = express.Router();
const db = require("../database/db");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

// Importa os middlewares
const verificarAutenticacao = require("../middlewares/auth.middleware");
const verificarPermissao = require("../middlewares/permission.middleware");

// Função auxiliar para verificar se é Admin
const verificarSeEhAdmin = (user) => {
    // 1. Verifica pelo E-mail Mestre (do Seed)
    if (user.email === 'admin@admin.com') return true;

    // 2. Verifica pelo Nome do Perfil (se estiver na sessão)
    if (user.nome_perfil === 'Administrador' || user.nome_perfil === 'Super Admin') return true;

    return false;
};

// -- LISTAR USUÁRIOS (COM FILTRO DE UNIDADE) --
router.get("/",
    verificarAutenticacao,
    verificarPermissao('usuarios', 'ver'),
    async (req, res) => {
        try {
            const userLogado = req.session.user;
            const ehAdmin = verificarSeEhAdmin(userLogado);

            let query = `
            SELECT u.id_usuario, u.nome_completo, u.email, u.ativo, 
                   p.nome_perfil, un.nome_fantasia as nome_unidade
            FROM usuario u
            LEFT JOIN perfil p ON u.id_perfil = p.id_perfil
            LEFT JOIN unidade un ON u.id_unidade = un.id_unidade
            WHERE 1=1 
        `;
            // O "WHERE 1=1" é um truque para facilitar adicionar ANDs depois

            const params = [];

            // SE NÃO FOR ADMIN: Esconde o admin da lista e filtra pela unidade
            if (!ehAdmin) {
                // Não mostra o Super Admin para usuários comuns
                query += ` AND u.email <> 'admin@admin.com'`;

                // Filtra apenas a unidade do usuário logado
                query += ` AND u.id_unidade = ?`;
                params.push(userLogado.id_unidade || userLogado.unidade_id);
            }

            query += ` ORDER BY u.nome_completo ASC`;

            const [usuarios] = await db.query(query, params);

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
router.get("/novo",
    verificarAutenticacao,
    verificarPermissao('usuarios', 'criar'),
    async (req, res) => {
        try {
            const userLogado = req.session.user;
            const ehAdmin = verificarSeEhAdmin(userLogado);

            // 1. Busca Perfis Ativos
            const [perfis] = await db.query("SELECT id_perfil, nome_perfil FROM perfil WHERE ativo = 1 and nome_perfil <> 'Administrador' ORDER BY nome_perfil ASC");

            // 2. Buscar Unidades
            let unidades = [];

            if (ehAdmin) {
                // ADMIN: Busca TODAS as unidades ativas
                const [rows] = await db.query("SELECT id_unidade, nome_fantasia, cidade FROM unidade WHERE ativo = 1 ORDER BY nome_fantasia ASC");
                unidades = rows;
            } else {
                // COMUM: Busca APENAS a unidade dele
                const idUnidadeUser = userLogado.id_unidade || userLogado.unidade_id;
                const [rows] = await db.query("SELECT id_unidade, nome_fantasia, cidade FROM unidade WHERE id_unidade = ?", [idUnidadeUser]);
                unidades = rows;
            }

            res.render("usuarios/usuario-form", {
                user: req.session.user,
                perfis: perfis,
                unidades: unidades,
                ehAdmin: ehAdmin,
                currentPage: 'usuarios'
            });

        } catch (error) {
            console.error("Erro ao carregar formulário:", error);
            res.redirect('/usuario');
        }
    });

// -- SALVAR NOVO USUÁRIO (POST) --
router.post("/novo",
    verificarAutenticacao,
    verificarPermissao('usuarios', 'criar'),
    async (req, res) => {
        let connection;
        try {
            const { nome, email, perfil, unidade } = req.body;
            const userLogado = req.session.user;
            const ehAdmin = verificarSeEhAdmin(userLogado);

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

            // 2. Definir a Unidade do Novo Usuário
            let idUnidadeFinal = null;

            if (ehAdmin) {
                // Admin usa o que veio do formulário
                idUnidadeFinal = unidade;
            } else {
                // Usuário comum é FORÇADO a cadastrar na própria unidade
                idUnidadeFinal = userLogado.id_unidade || userLogado.unidade_id;
            }

            if (!idUnidadeFinal || idUnidadeFinal.trim() === "") {
                connection.release();
                return res.status(400).json({ success: false, message: "Erro: Unidade é obrigatória." });
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

// =========================================================================
// ROTA ADICIONADA: INATIVAR MÚLTIPLOS
// =========================================================================
router.post("/inativar-multiplos",
    verificarAutenticacao,
    verificarPermissao('usuarios', 'inativar'), // Garanta que a permissão 'inativar' existe no BD
    async (req, res) => {
        try {
            const { ids } = req.body;

            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({ success: false, message: "Nenhum usuário selecionado." });
            }

            // Evita inativar o 'admin@admin.com' por segurança
            const query = `UPDATE usuario SET ativo = 0 WHERE id_usuario IN (?) AND email <> 'admin@admin.com'`;

            await db.query(query, [ids]);

            res.json({ success: true, message: "Usuários inativados com sucesso!" });

        } catch (error) {
            console.error("Erro ao inativar usuários:", error);
            res.status(500).json({ success: false, message: "Erro ao processar inativação." });
        }
    });

module.exports = router;