const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { v4: uuidv4 } = require("uuid");

const verificarAutenticacao = require("../middlewares/auth.middleware");
const verificarPermissao = require("../middlewares/permission.middleware");

// Função auxiliar para verificar se é Admin
const verificarSeEhAdmin = (user) => {
    if (user.email === 'admin@admin.com') return true;
    if (user.nome_perfil === 'Administrador' || user.nome_perfil === 'Super Admin') return true;
    return false;
};

// --- LISTAR SERVIÇOS (ISOLAMENTO TOTAL) ---
router.get("/",
    verificarAutenticacao,
    verificarPermissao('servicos', 'ver'),
    async (req, res) => {
        try {
            const userLogado = req.session.user;
            const ehAdmin = verificarSeEhAdmin(userLogado);

            // Busca serviços e faz join com unidade para exibir o nome da filial (para o admin ver)
            let query = `
            SELECT s.id_servico, s.nome_servico, s.descricao, s.ativo, s.id_unidade,
                   u.nome_fantasia as nome_unidade
            FROM servico s
            LEFT JOIN unidade u ON s.id_unidade = u.id_unidade
            WHERE s.deleted_at IS NULL
        `;

            const params = [];

            // REGRA DE OURO: ISOLAMENTO TOTAL
            // Se NÃO for Admin, ele OBRIGATORIAMENTE só vê o que é da unidade dele.
            // Removemos a visualização de globais (IS NULL).
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

// --- TELA DE NOVO SERVIÇO (GET) ---
router.get("/novo",
    verificarAutenticacao,
    verificarPermissao('servicos', 'criar'),
    async (req, res) => {
        try {
            const userLogado = req.session.user;
            const ehAdmin = verificarSeEhAdmin(userLogado);

            // Busca usuários para serem responsáveis
            let sqlUsers = `
            SELECT u.id_usuario, u.nome_completo 
            FROM usuario u
            JOIN perfil p ON u.id_perfil = p.id_perfil
            WHERE u.ativo = 1
            AND p.nome_perfil NOT IN ('Administrador', 'Super Admin')
        `;

            const paramsUsers = [];

            // Filtro de unidade para o SELECT de responsáveis
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

// --- SALVAR NOVO SERVIÇO (POST) ---
router.post("/novo",
    verificarAutenticacao,
    verificarPermissao('servicos', 'criar'),
    async (req, res) => {
        let connection;
        try {
            const { nome_servico, descricao, responsaveis } = req.body;
            const userLogado = req.session.user;
            const ehAdmin = verificarSeEhAdmin(userLogado);

            if (!nome_servico) {
                return res.status(400).json({ success: false, message: "Nome do serviço é obrigatório." });
            }

            connection = await db.getConnection();
            await connection.beginTransaction();

            // DEFINIÇÃO DE UNIDADE NO CADASTRO
            let idUnidadeFinal = null;

            if (ehAdmin) {
                // Se o Admin criar, por padrão neste código estamos criando como GLOBAL (NULL).
                // Se você quiser que o Admin crie para uma unidade específica, 
                // teria que adicionar um select de Unidade no formulário para o Admin.
                // Por enquanto, vou manter NULL (Global) para Admin, mas o usuário comum NÃO VÊ.
                idUnidadeFinal = null;
            } else {
                // Usuário comum SEMPRE grava na sua unidade
                idUnidadeFinal = userLogado.id_unidade || userLogado.unidade_id;
            }

            const idServico = uuidv4();

            // Insere o Serviço
            await connection.query(
                `INSERT INTO servico (id_servico, id_unidade, nome_servico, descricao, ativo) VALUES (?, ?, ?, ?, 1)`,
                [idServico, idUnidadeFinal, nome_servico, descricao]
            );

            // Insere os Vínculos de Responsáveis (Tabela Pivô)
            if (responsaveis) {
                const listaIds = Array.isArray(responsaveis) ? responsaveis : [responsaveis];

                for (const idUsuario of listaIds) {
                    // Verificação de segurança extra: O usuário responsável pertence à mesma unidade?
                    // (Opcional, mas boa prática. O filtro do GET já preveniu visualmente)

                    await connection.query(
                        `INSERT INTO servico_responsavel (id_servico, id_usuario) VALUES (?, ?)`,
                        [idServico, idUsuario]
                    );
                }
            }

            await connection.commit();
            res.json({ success: true, message: "Serviço cadastrado com sucesso!" });

        } catch (error) {
            if (connection) await connection.rollback();
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
            if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: "Nenhum ID." });

            const validIds = ids.map(id => String(id).trim()).filter(id => id.length > 0);
            const placeholders = validIds.map(() => '?').join(',');

            // Soft Delete (ativo = 0)
            const sql = `UPDATE servico SET ativo = 0 WHERE id_servico IN (${placeholders})`;
            const [result] = await db.query(sql, validIds);

            return res.json({ success: true, message: "Serviços inativados." });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Erro interno." });
        }
    });

module.exports = router;