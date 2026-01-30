const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { v4: uuidv4 } = require("uuid");

const verificarAutenticacao = require("../middlewares/auth.middleware");
const verificarPermissao = require("../middlewares/permission.middleware");

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
            query += ` AND (s.id_unidade IS NULL OR s.id_unidade = ?)`;
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

// --- TELA DE NOVO SERVIÇO (GET) ---
router.get("/novo",
    verificarAutenticacao,
    verificarPermissao('servicos', 'criar'),
    async (req, res) => {
        try {
            const userLogado = req.session.user;
            const ehAdmin = verificarSeEhAdmin(userLogado);

            // QUERY INTELIGENTE DE USUÁRIOS
            // 1. Busca usuários ativos
            // 2. Faz JOIN com Perfil para saber o nome do perfil
            // 3. Filtra: O perfil NÃO pode ser Administrador ou Super Admin
            let sqlUsers = `
            SELECT u.id_usuario, u.nome_completo 
            FROM usuario u
            JOIN perfil p ON u.id_perfil = p.id_perfil
            WHERE u.ativo = 1
            AND p.nome_perfil NOT IN ('Administrador', 'Super Admin')
        `;

            const paramsUsers = [];

            // 4. Se quem está logado NÃO é Admin, aplica o filtro de unidade
            // Ou seja: Admin vê técnicos de todas as unidades, mas o Gerente de Ariquemes só vê técnicos de Ariquemes.
            if (!ehAdmin) {
                sqlUsers += ` AND u.id_unidade = ?`;
                paramsUsers.push(userLogado.id_unidade || userLogado.unidade_id);
            }

            sqlUsers += ` ORDER BY u.nome_completo ASC`;

            const [usuarios] = await db.query(sqlUsers, paramsUsers);

            res.render("servicos/servico-form", {
                user: req.session.user,
                usuarios: usuarios, // Lista já filtrada
                currentPage: 'servicos'
            });

        } catch (error) {
            console.error("Erro ao carregar form:", error);
            res.redirect('/servicos');
        }
    });

// --- SALVAR NOVO SERVIÇO (POST) ---
router.post("/novo", verificarAutenticacao, verificarPermissao('servicos', 'criar'), async (req, res) => {
    let connection;
    try {
        const { nome_servico, descricao, responsaveis } = req.body; // responsaveis é um array de IDs
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        if (!nome_servico) {
            return res.status(400).json({ success: false, message: "Nome obrigatório." });
        }

        connection = await db.getConnection();
        await connection.beginTransaction(); // Inicia transação

        // 1. Define Unidade
        let idUnidadeFinal = null;
        if (!ehAdmin) {
            idUnidadeFinal = userLogado.id_unidade || userLogado.unidade_id;
        }

        // 2. Insere Serviço
        const idServico = uuidv4();
        await connection.query(
            `INSERT INTO servico (id_servico, id_unidade, nome_servico, descricao, ativo) VALUES (?, ?, ?, ?, 1)`,
            [idServico, idUnidadeFinal, nome_servico, descricao]
        );

        // 3. Insere Vínculos (Serviço <-> Usuários)
        if (responsaveis) {
            // Garante que é um array (se vier só um, o express as vezes manda como string)
            const listaIds = Array.isArray(responsaveis) ? responsaveis : [responsaveis];

            for (const idUsuario of listaIds) {
                await connection.query(
                    `INSERT INTO servico_responsavel (id_servico, id_usuario) VALUES (?, ?)`,
                    [idServico, idUsuario]
                );
            }
        }

        await connection.commit(); // Salva tudo
        res.json({ success: true, message: "Serviço cadastrado com sucesso!" });

    } catch (error) {
        if (connection) await connection.rollback(); // Desfaz se der erro
        console.error("Erro ao salvar serviço:", error);
        res.status(500).json({ success: false, message: "Erro interno ao salvar." });
    } finally {
        if (connection) connection.release();
    }
});

// --- INATIVAR MÚLTIPLOS ---
router.post("/inativar-multiplos",
    verificarAutenticacao,
    verificarPermissao('servicos', 'editar'),
    async (req, res) => {
        try {
            const { ids } = req.body;
            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({ success: false, message: "Nenhum ID selecionado." });
            }
            const validIds = ids.map(id => String(id).trim()).filter(id => id.length > 0);

            const placeholders = validIds.map(() => '?').join(',');
            const sql = `UPDATE servico SET ativo = 0 WHERE id_servico IN (${placeholders})`;

            const [result] = await db.query(sql, validIds);

            return res.json({
                success: true,
                message: `${result.affectedRows} serviço(s) inativado(s) com sucesso!`
            });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Erro interno." });
        }
    });

module.exports = router;