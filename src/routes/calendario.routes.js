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
// 1. TELA DO CALENDÁRIO (GET /)
// =============================================================================
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        // Vamos buscar os ITENS (tarefas) diretamente, para plotar no calendário
        let sql = `
            SELECT 
                osi.id_item,
                os.id_ordem_servico AS id_contrato,
                os.contrato_numero,
                c.nome_empresa,
                s.nome_servico,
                osi.status_item,
                osi.prazo_execucao_dias,
                os.data_abertura,
                
                -- Calcula a data limite exata em que a tarefa vence
                DATE_ADD(os.data_abertura, INTERVAL osi.prazo_execucao_dias DAY) AS data_limite
                
                -- DICA: Se você for criar uma coluna no banco pra salvar o dia que o usuário 
                -- "planejou" fazer (clicando no calendário), você adiciona ela aqui:
                -- , osi.data_planejada 

            FROM ordem_servico_item osi
            JOIN ordem_servico os ON osi.id_ordem_servico = os.id_ordem_servico
            JOIN cliente c ON os.id_cliente = c.id_cliente
            JOIN servico s ON osi.id_servico = s.id_servico
            WHERE os.deleted_at IS NULL AND os.status != 'Cancelada'
        `;

        const params = [];

        if (!ehAdmin) {
            // Filtra para trazer APENAS as tarefas onde o usuário logado é o responsável
            sql += ` AND osi.id_responsavel_execucao = ? `;
            params.push(userLogado.id_usuario);

            // Filtra pela unidade do usuário
            sql += ` AND os.id_unidade = ? `;
            params.push(userLogado.id_unidade || userLogado.unidade_id);
        }

        const [tarefas] = await db.query(sql, params);

        res.render("scrum/calendario", {
            user: userLogado,
            currentPage: 'calendario',
            tarefas: tarefas,
            tarefasJson: JSON.stringify(tarefas) 
        });

    } catch (error) {
        console.error("Erro ao carregar calendário:", error);
        res.status(500).send("Erro interno ao carregar o calendário.");
    }
});

module.exports = router;