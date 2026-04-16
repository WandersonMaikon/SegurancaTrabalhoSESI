const express = require("express");
const router = express.Router();
const db = require("../database/db");
const verificarAutenticacao = require("../middlewares/auth.middleware");

// Função auxiliar para verificar se é Admin
const verificarSeEhAdmin = (user) => {
    if (user.email === 'admin@admin.com') return true;
    if (user.nome_perfil === 'Administrador' || user.nome_perfil === 'Super Admin') return true;
    return false;
};

// =============================================================================
// 1. TELA DA LISTA (GET /) - Onde ficam os Cards dos Contratos
// =============================================================================
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        // A MÁGICA AQUI: O INNER JOIN filtra as tarefas e a matemática
        // EXCLUSIVAMENTE para o usuário logado, ignorando o resto da equipe!
        let sql = `
            SELECT
                os.id_ordem_servico AS id_contrato,
                os.contrato_numero AS numero_contrato,
                c.nome_empresa,
                COUNT(osi.id_item) AS total_tarefas,
                1 AS membros,
                
                -- STATUS INDIVIDUALIZADO: Ignora o status global e foca no usuário
                CASE 
                    WHEN os.status = 'Cancelada' THEN 'Cancelada'
                    WHEN COUNT(osi.id_item) > 0 AND SUM(IF(osi.status_item = 'Feito', 1, 0)) = COUNT(osi.id_item) THEN 'Concluída'
                    WHEN SUM(IF(osi.status_item = 'Feito', 1, 0)) > 0 THEN 'Em Andamento'
                    ELSE 'Aberta'
                END AS status,

                COALESCE(ROUND((SUM(IF(osi.status_item = 'Feito', 1, 0)) / NULLIF(COUNT(osi.id_item), 0)) * 100), 0) AS progresso,
                
                COALESCE(
                    DATEDIFF(
                        MIN(CASE WHEN osi.status_item != 'Feito' THEN DATE_ADD(os.data_abertura, INTERVAL osi.prazo_execucao_dias DAY) ELSE NULL END),
                        CURRENT_DATE()
                    ),
                    DATEDIFF(
                        MAX(DATE_ADD(os.data_abertura, INTERVAL osi.prazo_execucao_dias DAY)),
                        CURRENT_DATE()
                    ),
                    0
                ) AS dias_restantes,

                SUBSTRING_INDEX(
                    GROUP_CONCAT(
                        CASE WHEN osi.status_item != 'Feito' THEN s.nome_servico ELSE NULL END
                        ORDER BY DATE_ADD(os.data_abertura, INTERVAL osi.prazo_execucao_dias DAY) ASC
                        SEPARATOR '|||'
                    ),
                    '|||',
                    1
                ) AS proxima_tarefa

            FROM ordem_servico os
            JOIN cliente c ON os.id_cliente = c.id_cliente
            -- O segredo tá aqui: Amarramos a tabela de itens direto no ID do usuário logado
            JOIN ordem_servico_item osi ON os.id_ordem_servico = osi.id_ordem_servico AND osi.id_responsavel_execucao = ?
            LEFT JOIN servico s ON osi.id_servico = s.id_servico
            WHERE os.deleted_at IS NULL AND os.status != 'Cancelada'
        `;

        const params = [userLogado.id_usuario];

        if (!ehAdmin) {
            sql += ` AND os.id_unidade = ? `;
            params.push(userLogado.id_unidade || userLogado.unidade_id);
        }

        // Ordenação inteligente: Joga seus projetos concluídos pro final da página,
        // e organiza os abertos por quem vence primeiro!
        sql += ` GROUP BY os.id_ordem_servico, os.contrato_numero, os.status, c.nome_empresa, os.data_abertura
                 ORDER BY (CASE WHEN SUM(IF(osi.status_item = 'Feito', 1, 0)) = COUNT(osi.id_item) THEN 1 ELSE 0 END), dias_restantes ASC`;

        const [projetos] = await db.query(sql, params);

        res.render("scrum/scrum-lista", {
            user: userLogado,
            currentPage: 'scrum-lista',
            projetos: projetos
        });

    } catch (error) {
        console.error("Erro ao carregar lista de scrum:", error);
        res.status(500).send("Erro interno.");
    }
});

// =============================================================================
// 2. TELA DO QUADRO KANBAN (GET /quadro/:id) - Tarefas de um contrato
// =============================================================================
router.get("/quadro/:id", verificarAutenticacao, async (req, res) => {
    try {
        const { id } = req.params;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        const [osRows] = await db.query(`
            SELECT os.id_ordem_servico, os.contrato_numero, c.nome_empresa
            FROM ordem_servico os
            JOIN cliente c ON os.id_cliente = c.id_cliente
            WHERE os.id_ordem_servico = ?
        `, [id]);

        if (osRows.length === 0) return res.status(404).send("Projeto não encontrado.");
        const os = osRows[0];

        // 1. Buscando a coluna data_conclusao no SQL
        let sqlItens = `
            SELECT
                osi.id_item, osi.status_item, osi.prazo_execucao_dias, osi.data_conclusao, s.nome_servico, u.nome_completo,
                COALESCE(DATEDIFF(DATE_ADD(os.data_abertura, INTERVAL osi.prazo_execucao_dias DAY), CURRENT_DATE()), 0) AS dias_restantes
            FROM ordem_servico_item osi
            JOIN servico s ON osi.id_servico = s.id_servico
            JOIN usuario u ON osi.id_responsavel_execucao = u.id_usuario
            JOIN ordem_servico os ON osi.id_ordem_servico = os.id_ordem_servico
            WHERE osi.id_ordem_servico = ?
        `;
        const paramsItens = [id];

        if (!ehAdmin) {
            sqlItens += ` AND osi.id_responsavel_execucao = ?`;
            paramsItens.push(userLogado.id_usuario);
        }

        const [itens] = await db.query(sqlItens, paramsItens);

        // 2. Tratando a data por extenso AQUI NO BACK-END
        itens.forEach(item => {
            if (item.status_item === 'Feito') {
                item.data_formatada = '--/--'; // Fallback de segurança
                if (item.data_conclusao) {
                    const d = new Date(item.data_conclusao);
                    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
                    item.data_formatada = String(d.getDate()).padStart(2, '0') + ' de ' + meses[d.getMonth()];
                }
            }
        });

        const tarefas = {
            'Pendente': itens.filter(i => i.status_item === 'Pendente'),
            'Em Execução': itens.filter(i => i.status_item === 'Em Execução'),
            'Feito': itens.filter(i => i.status_item === 'Feito')
        };

        res.render("scrum/scrum-board", {
            user: userLogado,
            currentPage: 'scrum-lista',
            os: os,
            tarefas: tarefas
        });

    } catch (error) {
        console.error("Erro ao carregar quadro do projeto:", error);
        res.status(500).send("Erro interno.");
    }
});

// =============================================================================
// 3. ATUALIZAR STATUS DA TAREFA VIA DRAG AND DROP (POST AJAX)
// =============================================================================
router.post("/atualizar-tarefa", verificarAutenticacao, async (req, res) => {
    try {
        const { id_item, novo_status } = req.body;

        // 3. Atualizando o banco e gravando o NOW()
        if (novo_status === 'Feito') {
            await db.query(
                "UPDATE ordem_servico_item SET status_item = ?, data_conclusao = NOW() WHERE id_item = ?",
                [novo_status, id_item]
            );
        } else {
            await db.query(
                "UPDATE ordem_servico_item SET status_item = ?, data_conclusao = NULL WHERE id_item = ?",
                [novo_status, id_item]
            );
        }

        const [itemRows] = await db.query(
            "SELECT id_ordem_servico FROM ordem_servico_item WHERE id_item = ?",
            [id_item]
        );

        if (itemRows.length > 0) {
            const idOS = itemRows[0].id_ordem_servico;

            if (novo_status === 'Em Execução' || novo_status === 'Feito') {
                await db.query(
                    "UPDATE ordem_servico SET status = 'Em Andamento' WHERE id_ordem_servico = ? AND status = 'Aberta'",
                    [idOS]
                );
            }

            const [totalRows] = await db.query(`
                SELECT
                    COUNT(id_item) AS total_tarefas,
                    SUM(IF(status_item = 'Feito', 1, 0)) AS tarefas_feitas
                FROM ordem_servico_item
                WHERE id_ordem_servico = ?
            `, [idOS]);

            const total = Number(totalRows[0].total_tarefas || 0);
            const feitas = Number(totalRows[0].tarefas_feitas || 0);

            if (total > 0 && total === feitas) {
                await db.query(
                    "UPDATE ordem_servico SET status = 'Concluída' WHERE id_ordem_servico = ? AND status != 'Cancelada'",
                    [idOS]
                );
            }
            else if (total > 0 && total !== feitas) {
                await db.query(
                    "UPDATE ordem_servico SET status = 'Em Andamento' WHERE id_ordem_servico = ? AND status = 'Concluída'",
                    [idOS]
                );
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Erro ao atualizar tarefa e automações da OS:", error);
        res.status(500).json({ success: false });
    }
});

module.exports = router;