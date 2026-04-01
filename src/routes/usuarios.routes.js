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

            const params = [];

            // SE NÃO FOR ADMIN: Esconde o admin da lista e filtra pela unidade
            if (!ehAdmin) {
                query += ` AND u.email <> 'admin@admin.com'`;
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

            const [perfis] = await db.query("SELECT id_perfil, nome_perfil FROM perfil WHERE ativo = 1 and nome_perfil <> 'Administrador' ORDER BY nome_perfil ASC");

            let unidades = [];
            if (ehAdmin) {
                const [rows] = await db.query("SELECT id_unidade, nome_fantasia, cidade FROM unidade WHERE ativo = 1 ORDER BY nome_fantasia ASC");
                unidades = rows;
            } else {
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

            const [existing] = await connection.query("SELECT id_usuario FROM usuario WHERE email = ?", [email]);
            if (existing.length > 0) {
                connection.release();
                return res.status(400).json({ success: false, message: "Este e-mail já está cadastrado." });
            }

            let idUnidadeFinal = null;
            if (ehAdmin) {
                idUnidadeFinal = unidade;
            } else {
                idUnidadeFinal = userLogado.id_unidade || userLogado.unidade_id;
            }

            if (!idUnidadeFinal || idUnidadeFinal.trim() === "") {
                connection.release();
                return res.status(400).json({ success: false, message: "Erro: Unidade é obrigatória." });
            }

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
                idUsuario, idUnidadeFinal, nome, email, senhaHash, perfil
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
// ROTA ADICIONADA: FORMULÁRIO DE EDITAR (GET)
// =========================================================================
router.get("/editar/:id",
    verificarAutenticacao,
    verificarPermissao('usuarios', 'editar'),
    async (req, res) => {
        try {
            const idUsuarioEdit = req.params.id;
            const userLogado = req.session.user;
            const ehAdmin = verificarSeEhAdmin(userLogado);

            // 1. Busca os dados do usuário a ser editado
            const [userEditResult] = await db.query(
                "SELECT id_usuario, nome_completo, email, id_perfil, id_unidade FROM usuario WHERE id_usuario = ?",
                [idUsuarioEdit]
            );

            if (userEditResult.length === 0) {
                return res.redirect('/usuario'); // Usuário não existe
            }

            const usuarioEdit = userEditResult[0];

            // 2. Busca Perfis Ativos (Traz todos para o Admin ver, ou oculta o Administrador para os normais)
            let sqlPerfis = "SELECT id_perfil, nome_perfil FROM perfil WHERE ativo = 1";
            if (!ehAdmin) sqlPerfis += " AND nome_perfil <> 'Administrador'";
            sqlPerfis += " ORDER BY nome_perfil ASC";

            const [perfis] = await db.query(sqlPerfis);

            // 3. Buscar Unidades
            let unidades = [];
            if (ehAdmin) {
                const [rows] = await db.query("SELECT id_unidade, nome_fantasia, cidade FROM unidade WHERE ativo = 1 ORDER BY nome_fantasia ASC");
                unidades = rows;
            } else {
                const idUnidadeUser = userLogado.id_unidade || userLogado.unidade_id;
                const [rows] = await db.query("SELECT id_unidade, nome_fantasia, cidade FROM unidade WHERE id_unidade = ?", [idUnidadeUser]);
                unidades = rows;
            }

            res.render("usuarios/usuario-editar", {
                user: req.session.user,
                usuarioEdit: usuarioEdit,
                perfis: perfis,
                unidades: unidades,
                ehAdmin: ehAdmin,
                currentPage: 'usuarios'
            });

        } catch (error) {
            console.error("Erro ao carregar formulário de edição:", error);
            res.redirect('/usuario');
        }
    });

// POST: Salvar a nova senha e os dados
router.post("/primeiro-acesso", verificarAutenticacao, async (req, res) => {
    try {
        // Capturando o novo campo
        const { cpf, telefone, data_nascimento, nova_senha } = req.body;
        const idUsuario = req.session.user.id_usuario;

        // Validando se tudo foi preenchido
        if (!cpf || !telefone || !data_nascimento || !nova_senha) {
            return res.status(400).json({ success: false, message: "Preencha todos os campos." });
        }

        if (nova_senha === 'mudar123') {
            return res.status(400).json({ success: false, message: "Você precisa escolher uma senha diferente da padrão." });
        }

        // Gera o hash da nova senha
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(nova_senha, salt);

        // Atualiza no banco incluindo a data_nascimento
        await db.query(`
            UPDATE usuario 
            SET cpf = ?, telefone = ?, data_nascimento = ?, senha_hash = ?, primeiro_acesso = FALSE 
            WHERE id_usuario = ?
        `, [cpf, telefone, data_nascimento, senhaHash, idUsuario]);

        // Atualiza a sessão atual
        req.session.user.primeiro_acesso = false;
        req.session.user.cpf = cpf;
        req.session.user.telefone = telefone;
        req.session.user.data_nascimento = data_nascimento;

        res.json({ success: true, message: "Conta configurada com sucesso!" });

    } catch (error) {
        console.error("Erro no primeiro acesso:", error);
        res.status(500).json({ success: false, message: "Erro interno no servidor." });
    }
});

// =========================================================================
// ROTA ADICIONADA: SALVAR EDIÇÃO (POST)
// =========================================================================
router.post("/editar/:id",
    verificarAutenticacao,
    verificarPermissao('usuarios', 'editar'),
    async (req, res) => {
        try {
            const idUsuarioEdit = req.params.id;
            const { nome, email, perfil, unidade } = req.body;
            const userLogado = req.session.user;
            const ehAdmin = verificarSeEhAdmin(userLogado);

            if (!nome || !email || !perfil) {
                return res.status(400).json({ success: false, message: "Preencha nome, email e perfil." });
            }

            // Proteção: Ninguém muda o e-mail do admin master, a menos que saiba o que tá fazendo
            const [checkAdmin] = await db.query("SELECT email FROM usuario WHERE id_usuario = ?", [idUsuarioEdit]);
            if (checkAdmin.length > 0 && checkAdmin[0].email === 'admin@admin.com' && email !== 'admin@admin.com') {
                return res.status(403).json({ success: false, message: "O e-mail do administrador principal não pode ser alterado." });
            }

            // 1. Verificar se E-mail já existe (ignorando o próprio usuário)
            const [existing] = await db.query("SELECT id_usuario FROM usuario WHERE email = ? AND id_usuario <> ?", [email, idUsuarioEdit]);
            if (existing.length > 0) {
                return res.status(400).json({ success: false, message: "Este e-mail já está sendo usado por outro usuário." });
            }

            // 2. Definir a Unidade
            let idUnidadeFinal = null;
            if (ehAdmin) {
                idUnidadeFinal = unidade;
            } else {
                idUnidadeFinal = userLogado.id_unidade || userLogado.unidade_id;
            }

            if (!idUnidadeFinal || idUnidadeFinal.toString().trim() === "") {
                return res.status(400).json({ success: false, message: "Erro: Unidade é obrigatória." });
            }

            // 3. Atualizar no Banco
            const sqlUpdate = `
                UPDATE usuario 
                SET id_unidade = ?, nome_completo = ?, email = ?, id_perfil = ?
                WHERE id_usuario = ?
            `;

            await db.query(sqlUpdate, [idUnidadeFinal, nome, email, perfil, idUsuarioEdit]);

            res.json({ success: true, message: "Usuário atualizado com sucesso!" });

        } catch (error) {
            console.error("ERRO AO EDITAR USUÁRIO:", error);
            res.status(500).json({ success: false, message: "Erro interno: " + error.message });
        }
    });

// =========================================================================
// INATIVAR MÚLTIPLOS
// =========================================================================
router.post("/inativar-multiplos",
    verificarAutenticacao,
    verificarPermissao('usuarios', 'inativar'),
    async (req, res) => {
        try {
            const { ids } = req.body;

            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({ success: false, message: "Nenhum usuário selecionado." });
            }

            const query = `UPDATE usuario SET ativo = 0 WHERE id_usuario IN (?) AND email <> 'admin@admin.com'`;
            await db.query(query, [ids]);

            res.json({ success: true, message: "Usuários inativados com sucesso!" });

        } catch (error) {
            console.error("Erro ao inativar usuários:", error);
            res.status(500).json({ success: false, message: "Erro ao processar inativação." });
        }
    });

module.exports = router;