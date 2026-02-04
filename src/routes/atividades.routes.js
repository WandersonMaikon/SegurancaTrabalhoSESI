const express = require("express");
const router = express.Router();
const db = require("../database/db");
const verificarAutenticacao = require("../middlewares/auth.middleware");

// Função auxiliar para formatar a data (Ex: "10:30")
const formatarHora = (dataISO) => {
    const d = new Date(dataISO);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

// Função para "Traduzir" tabelas e ações para humano
const humanizarLog = (log) => {
    let titulo = "";
    let detalhe = "";
    let cor = "primary"; // primary, green, red, yellow
    let icone = "file-text";

    // Tradução das Tabelas
    const tabelas = {
        'ordem_servico': 'Ordem de Serviço',
        'cliente': 'Cliente',
        'epi': 'EPI',
        'risco': 'Risco',
        'usuario': 'Usuário',
        'documento': 'Documento'
    };
    const nomeTabela = tabelas[log.tabela_afetada] || log.tabela_afetada;

    // Lógica de Ação
    if (log.acao === 'INSERT') {
        titulo = `Criou um novo registro em <strong>${nomeTabela}</strong>`;
        cor = "green-500";
        icone = "plus";
    } else if (log.acao === 'UPDATE') {
        titulo = `Atualizou informações em <strong>${nomeTabela}</strong>`;
        cor = "sky-500";
        icone = "edit";

        // Tenta ser específico se for OS (Exemplo baseada no JSON)
        if (log.tabela_afetada === 'ordem_servico' && log.dados_novos) {
            try {
                const dados = typeof log.dados_novos === 'string' ? JSON.parse(log.dados_novos) : log.dados_novos;
                if (dados.status) {
                    titulo = `Alterou status da OS para <span class="text-${cor}">${dados.status}</span>`;
                }
            } catch (e) { }
        }
    } else if (log.acao === 'DELETE' || log.acao === 'INATIVAR') {
        titulo = `Removeu/Inativou um registro em <strong>${nomeTabela}</strong>`;
        cor = "red-500";
        icone = "trash";
    } else if (log.acao === 'LOGIN') {
        titulo = "Realizou login no sistema";
        cor = "primary";
        icone = "log-in";
    }

    return {
        titulo,
        hora: formatarHora(log.data_acao),
        data_full: log.data_acao, // Para agrupamento
        cor,
        icone,
        usuario_nome: log.nome_completo,
        usuario_avatar: log.avatar || null // Se tiver coluna de avatar
    };
};

// --- ROTA DE TELA (Renderiza o HTML básico) ---
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const idUnidade = userLogado.id_unidade || userLogado.unidade_id;

        // Buscar lista de usuários da unidade para o filtro (Select)
        const [usuarios] = await db.query(
            "SELECT id_usuario, nome_completo FROM usuario WHERE id_unidade = ? AND ativo = 1 ORDER BY nome_completo",
            [idUnidade]
        );

        res.render("usuarios/atividades", {
            user: userLogado,
            currentPage: 'atividades',
            listaUsuarios: usuarios
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Erro ao carregar tela.");
    }
});

// --- API DE DADOS (Retorna JSON para o JavaScript da tela) ---
router.get("/api/listar", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const idUnidade = userLogado.id_unidade || userLogado.unidade_id;

        // Filtros via Query Params
        const { id_usuario, modulo, data_inicio } = req.query;
        const limit = 20; // Paginação simples

        let sql = `
            SELECT l.*, u.nome_completo 
            FROM log_atividade l
            LEFT JOIN usuario u ON l.id_usuario = u.id_usuario
            WHERE l.id_unidade = ?
        `;
        const params = [idUnidade];

        if (id_usuario) {
            sql += " AND l.id_usuario = ?";
            params.push(id_usuario);
        }

        if (modulo) { // Filtro por tabela
            sql += " AND l.tabela_afetada = ?";
            params.push(modulo);
        }

        if (data_inicio) {
            sql += " AND DATE(l.data_acao) = ?";
            params.push(data_inicio);
        }

        sql += " ORDER BY l.data_acao DESC LIMIT ?";
        params.push(limit);

        const [logs] = await db.query(sql, params);

        // Processar logs para formato visual
        const logsFormatados = logs.map(log => humanizarLog(log));

        res.json({ success: true, data: logsFormatados });

    } catch (error) {
        console.error("Erro API Logs:", error);
        res.status(500).json({ success: false, message: "Erro ao buscar logs" });
    }
});

module.exports = router;