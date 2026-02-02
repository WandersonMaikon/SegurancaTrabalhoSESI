const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { v4: uuidv4 } = require('uuid');
const verificarAutenticacao = require("../middlewares/auth.middleware");

const verificarSeEhAdmin = (user) => {
    if (user.email === 'admin@admin.com') return true;
    if (user.nome_perfil === 'Administrador' || user.nome_perfil === 'Super Admin') return true;
    return false;
};

// --- LISTAR OS (Mantido igual) ---
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        let query = `
            SELECT os.id_ordem_servico, os.contrato_numero, os.valor_total_contrato, os.data_abertura, os.status, 
                   c.nome_empresa, u.nome_fantasia as nome_unidade
            FROM ordem_servico os
            JOIN cliente c ON os.id_cliente = c.id_cliente
            JOIN unidade u ON os.id_unidade = u.id_unidade
            WHERE os.deleted_at IS NULL
        `;
        const params = [];
        if (!ehAdmin) {
            query += ` AND os.id_unidade = ?`;
            params.push(userLogado.id_unidade || userLogado.unidade_id);
        }
        query += ` ORDER BY os.created_at DESC`;
        const [ordens] = await db.query(query, params);

        res.render("servicos/os-lista", {
            user: req.session.user,
            currentPage: 'ordem-servicos',
            ordensJson: JSON.stringify(ordens),
            ehAdmin: ehAdmin
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Erro ao carregar Ordens de Serviço.");
    }
});

// --- TELA DE NOVA OS (GET) ---
router.get("/novo", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        let filtroUnidade = "";
        let paramsUnidade = [];

        if (!ehAdmin) {
            filtroUnidade = "AND id_unidade = ?";
            paramsUnidade.push(userLogado.id_unidade || userLogado.unidade_id);
        }

        // 1. Clientes (Empresas)
        const [clientes] = await db.query(
            `SELECT id_cliente, nome_empresa, cnpj FROM cliente WHERE deleted_at IS NULL ${filtroUnidade} ORDER BY nome_empresa ASC`,
            paramsUnidade
        );

        // 2. Serviços Disponíveis
        let sqlServicos = `SELECT id_servico, nome_servico FROM servico WHERE deleted_at IS NULL AND ativo = 1`;
        let paramsServicos = [];
        if (!ehAdmin) {
            sqlServicos += ` AND (id_unidade IS NULL OR id_unidade = ?)`;
            paramsServicos.push(userLogado.id_unidade || userLogado.unidade_id);
        }
        sqlServicos += ` ORDER BY nome_servico ASC`;
        const [servicos] = await db.query(sqlServicos, paramsServicos);

        // 3. VÍNCULOS (Serviço x Responsável)
        // Aqui está a mágica: Trazemos quem pode fazer o que.
        let sqlVinculos = `
            SELECT sr.id_servico, u.id_usuario, u.nome_completo
            FROM servico_responsavel sr
            JOIN usuario u ON sr.id_usuario = u.id_usuario
            WHERE u.ativo = 1 AND u.deleted_at IS NULL
        `;
        let paramsVinculos = [];

        if (!ehAdmin) {
            sqlVinculos += ` AND u.id_unidade = ?`;
            paramsVinculos.push(userLogado.id_unidade || userLogado.unidade_id);
        }

        const [vinculos] = await db.query(sqlVinculos, paramsVinculos);

        // Agrupamos no Backend ou enviamos o JSON puro para o Frontend tratar
        // Vamos enviar puro e filtrar no JS do navegador, é mais rápido.

        res.render("servicos/os-form", {
            user: req.session.user,
            currentPage: 'ordem-servicos',
            clientes: clientes,
            servicos: servicos,
            vinculosJson: JSON.stringify(vinculos) // Passamos como JSON string
        });

    } catch (error) {
        console.error("Erro ao carregar form OS:", error);
        res.redirect('/ordem-servico');
    }
});

// --- SALVAR NOVA OS (POST) ---
router.post("/salvar", verificarAutenticacao, async (req, res) => {
    let connection;
    try {
        const data = req.body;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        if (!data.contratante_id || !data.contrato_numero || !data.valor_total_contrato) {
            return res.status(400).json({ success: false, message: "Preencha os dados obrigatórios." });
        }

        let idUnidadeOS = null;
        if (ehAdmin) {
            const [clienteRows] = await db.query("SELECT id_unidade FROM cliente WHERE id_cliente = ?", [data.contratante_id]);
            if (clienteRows.length > 0) idUnidadeOS = clienteRows[0].id_unidade;
            else return res.status(400).json({ success: false, message: "Cliente inválido." });
        } else {
            idUnidadeOS = userLogado.id_unidade || userLogado.unidade_id;
        }

        let valorLimpo = data.valor_total_contrato.replace("R$", "").replace(/\./g, "").replace(",", ".").trim();

        connection = await db.getConnection();
        await connection.beginTransaction();

        const idOS = uuidv4();

        await connection.query(
            `INSERT INTO ordem_servico (
                id_ordem_servico, id_unidade, contrato_numero, id_cliente, 
                valor_total_contrato, data_abertura, status, criado_por
            ) VALUES (?, ?, ?, ?, ?, NOW(), 'Aberta', ?)`,
            [idOS, idUnidadeOS, data.contrato_numero, data.contratante_id, valorLimpo, userLogado.id_usuario]
        );

        let itens = data.escopo || [];
        if (!Array.isArray(itens) && typeof itens === 'object') itens = Object.values(itens);

        for (const item of itens) {
            if (item.servico_id && item.responsavel_id) {
                await connection.query(
                    `INSERT INTO ordem_servico_item (
                        id_item, id_ordem_servico, id_servico, id_responsavel_execucao, quantidade, status_item
                    ) VALUES (?, ?, ?, ?, ?, 'Pendente')`,
                    [uuidv4(), idOS, item.servico_id, item.responsavel_id, item.quantidade || 1]
                );
            }
        }

        await connection.commit();
        res.json({ success: true, message: "Ordem de Serviço criada com sucesso!" });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao salvar OS:", error);
        res.status(500).json({ success: false, message: "Erro interno ao salvar OS." });
    } finally {
        if (connection) connection.release();
    }
});

router.post("/inativar-multiplos", verificarAutenticacao, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: "Nenhum registro selecionado." });
        const validIds = ids.map(id => String(id).trim()).filter(id => id.length > 0);
        const placeholders = validIds.map(() => '?').join(',');
        const sql = `UPDATE ordem_servico SET deleted_at = NOW() WHERE id_ordem_servico IN (${placeholders})`;
        await db.query(sql, validIds);
        return res.json({ success: true, message: "Registros inativados." });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Erro interno." });
    }
});

module.exports = router;