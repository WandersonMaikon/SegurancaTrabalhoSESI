const express = require("express");
const router = express.Router();
const crypto = require("crypto"); // Para gerar UUID
const db = require("../database/db");
const verificarAutenticacao = require("../middlewares/auth.middleware");
const excelJS = require('exceljs');

// =========================================================================
// ROTAS PÚBLICAS (COMPARTILHAMENTO ESTILO GOOGLE FORMS) - SEM AUTENTICAÇÃO
// =========================================================================

// GET: Renderiza o formulário público para o trabalhador responder
router.get("/responder/:id_cliente", async (req, res) => {
    try {
        const { id_cliente } = req.params;

        // 1. Verifica se a empresa existe e está ativa
        const [empresa] = await db.query(
            "SELECT id_cliente, nome_empresa, id_unidade FROM cliente WHERE id_cliente = ? AND ativo = 1 AND deleted_at IS NULL",
            [id_cliente]
        );

        if (empresa.length === 0) {
            return res.status(404).send("Formulário não encontrado ou empresa inativa.");
        }

        // 2. TRAVA DE SEGURANÇA: Verifica se a coleta já foi encerrada pelo técnico
        const [sessao] = await db.query(
            "SELECT status_sessao FROM checklist_job_stress WHERE id_cliente = ? ORDER BY created_at DESC LIMIT 1",
            [id_cliente]
        );

        if (sessao.length > 0 && sessao[0].status_sessao === 'Concluido') {
            return res.send(`
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 10vh 20px; background-color: #f4f4f5; min-height: 100vh;">
                    <div style="background: white; max-width: 400px; margin: 0 auto; padding: 40px 20px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                        <h2 style="color: #dc2626; margin-bottom: 10px;">Coleta Encerrada</h2>
                        <p style="color: #52525b; line-height: 1.5;">A pesquisa de clima para <strong>${empresa[0].nome_empresa}</strong> já foi finalizada pelo departamento responsável. Obrigado!</p>
                    </div>
                </div>
            `);
        }

        // 3. Renderiza a TELA focada no funcionário (se a coleta estiver aberta)
        res.render("formularios/checklist-stress-publico", {
            layout: false,
            empresa: empresa[0]
        });

    } catch (error) {
        console.error("Erro ao carregar formulário público:", error);
        res.status(500).send("Erro interno ao carregar a página.");
    }
});

// POST: Salvar a resposta do trabalhador via Link Público
router.post("/responder/salvar", async (req, res) => {
    try {
        const { id_cliente, id_unidade, setor_cargo, respostas, duracao_segundos } = req.body;

        // TRAVA DE SEGURANÇA NO SALVAMENTO (Evita envio de respostas se o link ficou aberto na aba do celular)
        const [sessao] = await db.query(
            "SELECT status_sessao FROM checklist_job_stress WHERE id_cliente = ? ORDER BY created_at DESC LIMIT 1",
            [id_cliente]
        );

        if (sessao.length > 0 && sessao[0].status_sessao === 'Concluido') {
            return res.status(403).json({ success: false, message: "A coleta para esta empresa já foi encerrada. Sua resposta não pôde ser salva." });
        }

        // ====================================================================
        // NOVO: Busca o ID do técnico que gerou o link para evitar erro de NULL
        // ====================================================================
        const [responsavelData] = await db.query(
            `SELECT id_responsavel FROM checklist_job_stress 
             WHERE id_cliente = ? AND id_unidade = ? AND id_responsavel IS NOT NULL
             ORDER BY created_at ASC LIMIT 1`,
            [id_cliente, id_unidade]
        );

        // Se não encontrar, passa nulo (embora a lógica garanta que vá encontrar)
        const id_responsavel = responsavelData.length > 0 ? responsavelData[0].id_responsavel : null;

        const id_checklist = crypto.randomUUID();

        // Pega a data atual do servidor para a aplicação
        const data_aplicacao = new Date().toISOString().split('T')[0];

        // Inclui metadados extras para você saber que veio pelo link
        const respostasComMetadados = {
            ...respostas,
            metadados: {
                origem: "Link Publico",
                duracao_segundos: duracao_segundos || 0
            }
        };

        // Salva no banco vinculando ao técnico responsável que abriu a sessão
        await db.query(`
            INSERT INTO checklist_job_stress 
            (id_checklist, id_unidade, id_cliente, id_responsavel, data_aplicacao, setor_cargo, respostas, status_sessao)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Em Andamento')
        `, [
            id_checklist, id_unidade, id_cliente, id_responsavel, data_aplicacao,
            setor_cargo || 'Não Informado', JSON.stringify(respostasComMetadados)
        ]);

        res.json({ success: true, message: "Resposta enviada com sucesso!" });
    } catch (error) {
        console.error("Erro ao salvar resposta pública:", error);
        res.status(500).json({ success: false, message: "Erro ao salvar os dados." });
    }
});

// =========================================================================
// ROTAS PRIVADAS (PAINEL DO TÉCNICO) - COM AUTENTICAÇÃO
// =========================================================================

// POST: Inicia a sessão gravando um registro "fantasma" para aparecer na listagem
router.post("/iniciar-sessao", verificarAutenticacao, async (req, res) => {
    try {
        const { id_cliente } = req.body;
        const userLogado = req.session.user;
        const id_unidade = userLogado.id_unidade || userLogado.unidade_id;

        // Verifica se já tem uma sessão iniciada para não duplicar o registro de setup
        const [existe] = await db.query(
            `SELECT id_checklist FROM checklist_job_stress 
             WHERE id_cliente = ? AND id_unidade = ? AND status_sessao = 'Em Andamento' AND deleted_at IS NULL LIMIT 1`,
            [id_cliente, id_unidade]
        );

        if (existe.length === 0) {
            const id_checklist = crypto.randomUUID();
            const data_aplicacao = new Date().toISOString().split('T')[0];

            // Insere o registro fantasma. O 'Setup da Sessão' serve pra gente filtrar depois
            await db.query(`
                INSERT INTO checklist_job_stress 
                (id_checklist, id_unidade, id_cliente, id_responsavel, data_aplicacao, setor_cargo, respostas, status_sessao)
                VALUES (?, ?, ?, ?, ?, 'Setup da Sessão', '{}', 'Em Andamento')
            `, [
                id_checklist, id_unidade, id_cliente, userLogado.id_usuario, data_aplicacao
            ]);
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Erro ao iniciar sessão:", error);
        res.status(500).json({ success: false });
    }
});

// GET: Renderiza a LISTAGEM (Dashboard)
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const id_unidade = userLogado.id_unidade || userLogado.unidade_id;

        const [checklists] = await db.query(
            `SELECT 
                c.id_cliente,
                c.nome_empresa,
                COUNT(CASE WHEN cjs.setor_cargo != 'Setup da Sessão' THEN 1 END) AS total_questionarios,
                MAX(cjs.created_at) AS raw_date, -- DATA BRUTA ADICIONADA AQUI
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

// GET: Renderiza o formulário do Painel do Técnico
router.get("/novo", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const id_unidade = userLogado.id_unidade || userLogado.unidade_id;

        const clienteQuery = req.query.cliente;
        let dadosContinuacao = { total_anterior: 0, ultimo_setor: '' };

        if (clienteQuery) {
            const [rows] = await db.query(
                `SELECT 
                    (SELECT COUNT(CASE WHEN setor_cargo != 'Setup da Sessão' THEN 1 END) FROM checklist_job_stress WHERE id_cliente = ? AND id_unidade = ? AND deleted_at IS NULL) AS total,
                    (SELECT setor_cargo FROM checklist_job_stress WHERE id_cliente = ? AND id_unidade = ? AND deleted_at IS NULL AND setor_cargo != 'Setup da Sessão' ORDER BY created_at DESC LIMIT 1) AS ultimo_setor`,
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
            dadosContinuacao: dadosContinuacao
        });

    } catch (error) {
        console.error("Erro ao carregar checklist:", error);
        res.status(500).send("Erro interno ao carregar a página.");
    }
});

// POST: Reabrir a coleta da empresa (Destrava o Link)
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

        res.json({ success: true, message: "Sessão reaberta! O link público voltou a funcionar." });
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
             WHERE id_cliente = ? AND setor_cargo = ? AND id_unidade = ? AND deleted_at IS NULL AND setor_cargo != 'Setup da Sessão'`,
            [id_cliente, setor, id_unidade]
        );

        return res.json({ success: true, total: rows[0].total });

    } catch (error) {
        console.error("Erro ao buscar contagem do setor:", error);
        return res.status(500).json({ success: false, message: 'Erro interno ao buscar histórico' });
    }
});

// GET: Busca o histórico consolidado de todos os setores de uma empresa (Para a Dashboard de Acompanhamento)
router.get("/historico-setores", verificarAutenticacao, async (req, res) => {
    try {
        const { id_cliente } = req.query;
        const userLogado = req.session.user;
        const id_unidade = userLogado.id_unidade || userLogado.unidade_id;

        if (!id_cliente) return res.json({ success: false, message: "ID do cliente não informado" });

        const [rows] = await db.query(
            `SELECT setor_cargo, COUNT(*) as total 
             FROM checklist_job_stress 
             WHERE id_cliente = ? AND id_unidade = ? AND deleted_at IS NULL AND setor_cargo != 'Setup da Sessão'
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

// =========================================================================
// ROTA: EXPORTAR EXCEL (Checklist Job Stress)
// =========================================================================
router.get("/exportar/excel/:id_cliente",
    verificarAutenticacao,
    async (req, res) => {
        try {
            const idCliente = req.params.id_cliente;

            // 1. Busca os dados do cliente
            const [empresa] = await db.query("SELECT nome_empresa FROM cliente WHERE id_cliente = ?", [idCliente]);
            const nomeEmpresa = empresa.length > 0 ? empresa[0].nome_empresa : "Empresa";

            // 2. Busca os questionários salvos (usando created_at para o Carimbo de Tempo exato, ignorando Setup)
            const sql = `
            SELECT 
                created_at, 
                setor_cargo, 
                respostas 
            FROM checklist_job_stress 
            WHERE id_cliente = ? AND setor_cargo != 'Setup da Sessão'
            ORDER BY created_at ASC
        `;
            const [avaliacoes] = await db.query(sql, [idCliente]);

            if (avaliacoes.length === 0) {
                return res.status(404).send("Nenhum questionário encontrado para esta empresa.");
            }

            // 3. Cria o arquivo Excel
            const workbook = new excelJS.Workbook();
            workbook.creator = 'Sistema ProS';
            const worksheet = workbook.addWorksheet('Job Stress Scale');

            // 4. Define as Colunas da Planilha
            worksheet.columns = [
                { header: 'Carimbo de data/hora', key: 'data', width: 20 },
                { header: 'Qual o seu local de trabalho?', key: 'local', width: 25 },
                { header: 'Com que frequência você tem que fazer suas tarefas de trabalho com muita rapidez?', key: 'q1', width: 35 },
                { header: 'Com que frequência você tem que trabalhar instensamente?', key: 'q2', width: 35 },
                { header: 'Seu trabalho exige demais de você?', key: 'q3', width: 25 },
                { header: 'Você tem tempo suficiente para cumprir todas as tarefas de seu trabalho?', key: 'q4', width: 35 },
                { header: 'O seu trabalho costuma apresentar exigências contraditórias ou discordantes?', key: 'q5', width: 35 },
                { header: 'Você tem possibilidade de aprender coisas novas em seu trabalho?', key: 'q6', width: 35 },
                { header: 'Seu trabalho exige muita habilidade ou conhecimento especializado?', key: 'q7', width: 35 },
                { header: 'Seu trabalho exige que você tome iniciativas?', key: 'q8', width: 30 },
                { header: 'No seu trabalho, você tem que repetir muitas vezes as mesmas tarefas?', key: 'q9', width: 35 },
                { header: 'Você pode escolher COMO fazer seu trabalho?', key: 'q10', width: 30 },
                { header: 'Você pode escolher O QUE fazer no seu trabalho?', key: 'q11', width: 30 },
                { header: 'Existe um ambiente calmo e agradável onde trabalho.', key: 'q12', width: 30 },
                { header: 'No trabalho, nos relacionamos bem uns com os outros.', key: 'q13', width: 30 },
                { header: 'Eu posso contar com o apoio dos meus colegas de trabalho.', key: 'q14', width: 35 },
                { header: 'Se eu não estiver num bom dia, meus colegas compreendem.', key: 'q15', width: 35 },
                { header: 'No trabalho, me relaciono bem com meus chefes.', key: 'q16', width: 30 },
                { header: 'Eu gosto de trabalhar com meus colegas.', key: 'q17', width: 30 }
            ];

            // Formata o cabeçalho
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDDDDD' } };

            // 5. Adiciona os dados linha a linha iterando sobre o JSON
            avaliacoes.forEach(av => {
                let respJSON = typeof av.respostas === 'string' ? JSON.parse(av.respostas) : av.respostas;

                const dataFormatada = new Date(av.created_at).toLocaleString('pt-BR', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                }).replace(',', '');

                worksheet.addRow({
                    data: dataFormatada,
                    local: av.setor_cargo || '-',
                    q1: respJSON.q1 || '-',
                    q2: respJSON.q2 || '-',
                    q3: respJSON.q3 || '-',
                    q4: respJSON.q4 || '-',
                    q5: respJSON.q5 || '-',
                    q6: respJSON.q6 || '-',
                    q7: respJSON.q7 || '-',
                    q8: respJSON.q8 || '-',
                    q9: respJSON.q9 || '-',
                    q10: respJSON.q10 || '-',
                    q11: respJSON.q11 || '-',
                    q12: respJSON.q12 || '-',
                    q13: respJSON.q13 || '-',
                    q14: respJSON.q14 || '-',
                    q15: respJSON.q15 || '-',
                    q16: respJSON.q16 || '-',
                    q17: respJSON.q17 || '-'
                });
            });

            // 6. Envia o arquivo para download
            const fileName = `Job_Stress_${nomeEmpresa.replace(/[^a-z0-9]/gi, '_')}.xlsx`;

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            console.error("Erro ao exportar Excel:", error);
            res.status(500).send("Erro interno ao gerar o arquivo Excel.");
        }
    });

module.exports = router;