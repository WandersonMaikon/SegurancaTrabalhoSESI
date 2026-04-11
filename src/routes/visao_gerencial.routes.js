const express = require("express");
const router = express.Router();
const db = require("../database/db");
const verificarAutenticacao = require("../middlewares/auth.middleware");

// Função auxiliar para verificar se é Admin
const verificarSeEhAdmin = (user) => {
    if (!user) return false;
    if (user.email === 'admin@admin.com') return true;
    if (user.nome_perfil === 'Administrador' || user.nome_perfil === 'Super Admin') return true;
    return false;
};

// =============================================================================
// VISÃO GERENCIAL DOS CONTRATOS (GET /)
// =============================================================================
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        // Bloqueio: Se não for admin, chuta de volta pro dashboard
        if (!ehAdmin) {
            return res.redirect('/dashboard');
        }

        // Query que traz a OS, Cliente e as Tarefas (Itens) tudo junto
        const sql = `
            SELECT 
                os.id_ordem_servico,
                os.contrato_numero,
                os.status AS status_os,
                os.data_abertura,
                c.nome_empresa,
                c.cidade,
                osi.id_item,
                osi.status_item,
                osi.prazo_execucao_dias,
                s.nome_servico,
                u.nome_completo AS responsavel
            FROM ordem_servico os
            JOIN cliente c ON os.id_cliente = c.id_cliente
            LEFT JOIN ordem_servico_item osi ON os.id_ordem_servico = osi.id_ordem_servico
            LEFT JOIN servico s ON osi.id_servico = s.id_servico
            LEFT JOIN usuario u ON osi.id_responsavel_execucao = u.id_usuario
            WHERE os.deleted_at IS NULL AND os.status != 'Cancelada'
            ORDER BY os.id_ordem_servico DESC
        `;

        const [rows] = await db.query(sql);

        // Agrupando os dados para mandar pro Front-end bonitinho
        const projetosMap = {};
        let totalEmAndamento = 0;
        let totalAtrasados = 0;

        rows.forEach(row => {
            // Cria o projeto no mapa se ainda não existir
            if (!projetosMap[row.id_ordem_servico]) {
                projetosMap[row.id_ordem_servico] = {
                    id: row.id_ordem_servico,
                    contrato: row.contrato_numero || 'S/N',
                    empresa: row.nome_empresa,
                    cidade: row.cidade || '-',
                    data_inicio: new Date(row.data_abertura),
                    status_os: row.status_os,
                    tarefas: [],
                    total_tarefas: 0,
                    tarefas_feitas: 0,
                    data_limite_geral: null, // <-- ADICIONADO PARA O HTML LER A PRIORIDADE
                    is_atrasado: false
                };
            }

            const proj = projetosMap[row.id_ordem_servico];

            // Se tiver tarefa vinculada, processa
            if (row.id_item) {
                proj.total_tarefas++;
                if (row.status_item === 'Feito') proj.tarefas_feitas++;

                // Calcula o prazo dessa tarefa específica
                const limiteItem = new Date(row.data_abertura);
                limiteItem.setDate(limiteItem.getDate() + row.prazo_execucao_dias);

                const hoje = new Date();
                // Remove a parte da hora para a comparação ser justa no dia
                hoje.setHours(0, 0, 0, 0);
                const limiteSemHora = new Date(limiteItem);
                limiteSemHora.setHours(0, 0, 0, 0);

                const atrasado = (row.status_item !== 'Feito' && limiteSemHora < hoje);

                if (atrasado) proj.is_atrasado = true;

                // <-- A MÁGICA DA DATA FINAL GERAL DO PROJETO AQUI -->
                if (!proj.data_limite_geral || limiteItem > proj.data_limite_geral) {
                    proj.data_limite_geral = limiteItem;
                }

                // Conta os dias de atraso pra mandar pro front
                let diasAtraso = 0;
                if (atrasado) {
                    const diffTime = Math.abs(hoje - limiteSemHora);
                    diasAtraso = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }

                proj.tarefas.push({
                    id: row.id_item,
                    nome: row.nome_servico || 'Serviço não especificado',
                    responsavel: row.responsavel ? row.responsavel.split(' ').slice(0, 2).join(' ') : 'Não Atribuído',
                    status: row.status_item,
                    data_limite: limiteItem,
                    atrasado: atrasado,
                    diasAtraso: diasAtraso
                });
            }
        });

        // Converte o objeto em array e calcula as porcentagens e totais
        const projetos = Object.values(projetosMap).map(p => {
            p.progresso = p.total_tarefas > 0 ? Math.round((p.tarefas_feitas / p.total_tarefas) * 100) : 0;

            if (p.status_os === 'Em Andamento') totalEmAndamento++;
            if (p.is_atrasado && p.status_os !== 'Concluída') totalAtrasados++;

            return p;
        });

        // Ordena para jogar os que têm tarefas atrasadas lá pro topo da tela
        projetos.sort((a, b) => {
            if (a.status_os === 'Concluída' && b.status_os !== 'Concluída') return 1;
            if (b.status_os === 'Concluída' && a.status_os !== 'Concluída') return -1;
            if (a.is_atrasado && !b.is_atrasado) return -1;
            if (b.is_atrasado && !a.is_atrasado) return 1;
            return 0; // Se empatar, deixa como veio do banco
        });

        // Renderiza a tela enviando os dados
        res.render("scrum/visao-gerencial", {
            user: userLogado,
            currentPage: 'visao-gerencial',
            projetos: projetos,
            indicadores: { emAndamento: totalEmAndamento, atrasados: totalAtrasados }
        });

    } catch (error) {
        console.error("Erro ao carregar Visão Gerencial:", error);
        res.status(500).send("Erro interno ao carregar painel.");
    }
});

module.exports = router;