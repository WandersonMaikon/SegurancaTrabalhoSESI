const express = require("express");
const router = express.Router();
const crypto = require("crypto"); // Para gerar UUID
const db = require("../database/db");
const verificarAutenticacao = require("../middlewares/auth.middleware");

// GET: Renderiza a LISTAGEM (Dashboard)
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const id_unidade = userLogado.id_unidade || userLogado.unidade_id;

        const [checklists] = await db.query(
            `SELECT 
                c.id_cliente,
                c.nome_empresa,
                COUNT(cjs.id_checklist) AS total_questionarios,
                DATE_FORMAT(MAX(cjs.created_at), '%d/%m/%Y às %H:%i') AS ultima_coleta,
                MIN(cjs.status_sessao) AS status_sessao 
             FROM checklist_job_stress cjs
             INNER JOIN cliente c ON cjs.id_cliente = c.id_cliente
             WHERE cjs.id_unidade = ? AND cjs.deleted_at IS NULL
             GROUP BY c.id_cliente, c.nome_empresa
             ORDER BY MAX(cjs.created_at) DESC`,
            [id_unidade]
        );

        res.render("formularios/checklist-stress-lista", {
            user: userLogado,
            currentPage: 'checklist-stress',
            checklistsJson: JSON.stringify(checklists)
        });

    } catch (error) {
        console.error("Erro ao carregar lista de checklists:", error);
        res.status(500).send("Erro interno ao carregar a página.");
    }
});

// POST: Encerrar a coleta da empresa definitivamente
router.post("/finalizar-empresa/:id_cliente", verificarAutenticacao, async (req, res) => {
    try {
        const { id_cliente } = req.params;
        const userLogado = req.session.user;
        const id_unidade = userLogado.id_unidade || userLogado.unidade_id;

        await db.query(
            `UPDATE checklist_job_stress 
             SET status_sessao = 'Concluido' 
             WHERE id_cliente = ? AND id_unidade = ?`,
            [id_cliente, id_unidade]
        );

        res.json({ success: true, message: "Coleta finalizada com sucesso!" });
    } catch (error) {
        console.error("Erro ao finalizar empresa:", error);
        res.status(500).json({ success: false, message: "Erro ao atualizar status." });
    }
});

// GET: Renderiza o formulário (AGORA MAIS INTELIGENTE)
router.get("/novo", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const id_unidade = userLogado.id_unidade || userLogado.unidade_id;

        const clienteQuery = req.query.cliente;
        let dadosContinuacao = { total_anterior: 0, ultimo_setor: '' };

        // Se estiver continuando uma coleta, busca o histórico para não começar do zero
        if (clienteQuery) {
            const [rows] = await db.query(
                `SELECT 
                    (SELECT COUNT(*) FROM checklist_job_stress WHERE id_cliente = ? AND id_unidade = ? AND deleted_at IS NULL) AS total,
                    (SELECT setor_cargo FROM checklist_job_stress WHERE id_cliente = ? AND id_unidade = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) AS ultimo_setor`,
                [clienteQuery, id_unidade, clienteQuery, id_unidade]
            );

            if (rows && rows.length > 0) {
                dadosContinuacao.total_anterior = rows[0].total || 0;
                dadosContinuacao.ultimo_setor = rows[0].ultimo_setor || '';
            }
        }

        const [clientes] = await db.query(
            "SELECT id_cliente, nome_empresa FROM cliente WHERE id_unidade = ? AND ativo = 1 AND deleted_at IS NULL ORDER BY nome_empresa ASC",
            [id_unidade]
        );

        res.render("formularios/checklist-stress-form", {
            user: userLogado,
            currentPage: 'checklist-stress',
            clientes: clientes,
            clienteSelecionado: clienteQuery || null,
            dadosContinuacao: dadosContinuacao // Enviando o histórico para a tela
        });

    } catch (error) {
        console.error("Erro ao carregar checklist:", error);
        res.status(500).send("Erro interno ao carregar a página.");
    }
});

// POST: Reabrir a coleta da empresa
router.post("/reabrir-empresa/:id_cliente", verificarAutenticacao, async (req, res) => {
    try {
        const { id_cliente } = req.params;
        const userLogado = req.session.user;
        const id_unidade = userLogado.id_unidade || userLogado.unidade_id;

        await db.query(
            `UPDATE checklist_job_stress 
             SET status_sessao = 'Em Andamento' 
             WHERE id_cliente = ? AND id_unidade = ?`,
            [id_cliente, id_unidade]
        );

        res.json({ success: true, message: "Sessão reaberta com sucesso!" });
    } catch (error) {
        console.error("Erro ao reabrir empresa:", error);
        res.status(500).json({ success: false, message: "Erro ao atualizar status." });
    }
});

// GET: Busca o histórico parcial por empresa e setor
router.get("/contagem", verificarAutenticacao, async (req, res) => {
    try {
        const { id_cliente, setor } = req.query;
        const userLogado = req.session.user;
        const id_unidade = userLogado.id_unidade || userLogado.unidade_id;

        if (!id_cliente || !setor) return res.json({ success: true, total: 0 });

        const [rows] = await db.query(
            `SELECT COUNT(*) as total 
             FROM checklist_job_stress 
             WHERE id_cliente = ? AND setor_cargo = ? AND id_unidade = ? AND deleted_at IS NULL`,
            [id_cliente, setor, id_unidade]
        );

        return res.json({ success: true, total: rows[0].total });

    } catch (error) {
        console.error("Erro ao buscar contagem do setor:", error);
        return res.status(500).json({ success: false, message: 'Erro interno ao buscar histórico' });
    }
});

// POST: Salvar os dados no banco
router.post("/novo", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const { id_cliente, data_aplicacao, nome_trabalhador, setor_cargo, respostas } = req.body;

        const id_checklist = crypto.randomUUID();
        const id_unidade = userLogado.id_unidade || userLogado.unidade_id;
        const id_responsavel = userLogado.id_usuario;

        await db.query(`
            INSERT INTO checklist_job_stress 
            (id_checklist, id_unidade, id_cliente, id_responsavel, data_aplicacao, nome_trabalhador, setor_cargo, respostas)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id_checklist, id_unidade, id_cliente, id_responsavel, data_aplicacao,
            nome_trabalhador || null, setor_cargo || null, JSON.stringify(respostas)
        ]);

        res.json({ success: true, message: "Checklist salvo com sucesso!" });
    } catch (error) {
        console.error("Erro ao salvar checklist:", error);
        res.status(500).json({ success: false, message: "Erro ao salvar os dados." });
    }
});
// GET: Busca o histórico consolidado de todos os setores de uma empresa
router.get("/historico-setores", verificarAutenticacao, async (req, res) => {
    try {
        const { id_cliente } = req.query;
        const userLogado = req.session.user;
        const id_unidade = userLogado.id_unidade || userLogado.unidade_id;

        if (!id_cliente) return res.json({ success: false, message: "ID do cliente não informado" });

        const [rows] = await db.query(
            `SELECT setor_cargo, COUNT(*) as total 
             FROM checklist_job_stress 
             WHERE id_cliente = ? AND id_unidade = ? AND deleted_at IS NULL
             GROUP BY setor_cargo
             ORDER BY total DESC, setor_cargo ASC`,
            [id_cliente, id_unidade]
        );

        return res.json({ success: true, dados: rows });
    } catch (error) {
        console.error("Erro ao buscar histórico consolidado:", error);
        return res.status(500).json({ success: false, message: 'Erro interno ao buscar setores' });
    }
});

module.exports = router;