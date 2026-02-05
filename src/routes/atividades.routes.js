const express = require("express");
const router = express.Router();
const db = require("../database/db");
const verificarAutenticacao = require("../middlewares/auth.middleware");

// --- FUNÇÕES AUXILIARES ---

const formatarHora = (dataISO) => {
    if (!dataISO) return "--:--";
    try {
        const d = new Date(dataISO);
        return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return "--:--";
    }
};

const humanizarLog = (log) => {
    let titulo = "";
    let cor = "primary";
    let icone = "file-text";

    const tabelas = {
        'ordem_servico': 'Ordem de Serviço',
        'cliente': 'Cliente',
        'epi': 'EPI',
        'epc': 'EPC',
        'risco': 'Risco',
        'usuario': 'Usuário',
        'documento': 'Documento',
        'unidade': 'Unidade'
    };

    const nomeTabela = tabelas[log.tabela_afetada] ||
        (log.tabela_afetada ? log.tabela_afetada.charAt(0).toUpperCase() + log.tabela_afetada.slice(1) : "Sistema");

    if (log.acao === 'INSERT') {
        titulo = `Criou um novo registro em <strong>${nomeTabela}</strong>`;
        cor = "green-500";
        icone = "plus";
        if (log.dados_novos) {
            try {
                const dados = typeof log.dados_novos === 'string' ? JSON.parse(log.dados_novos) : log.dados_novos;
                if (dados.nome || dados.nome_risco || dados.nome_empresa) {
                    titulo = `Cadastrou <strong>${dados.nome || dados.nome_risco || dados.nome_empresa}</strong> em ${nomeTabela}`;
                }
            } catch (e) { }
        }
    } else if (log.acao === 'UPDATE') {
        titulo = `Atualizou informações em <strong>${nomeTabela}</strong>`;
        cor = "sky-500";
        icone = "edit";
        if (log.dados_novos) {
            try {
                const dados = typeof log.dados_novos === 'string' ? JSON.parse(log.dados_novos) : log.dados_novos;
                if (dados.status) {
                    titulo = `Alterou status para <span class="text-${cor} font-bold">${dados.status}</span>`;
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
        titulo: titulo,
        hora: formatarHora(log.data_acao),
        data_full: log.data_acao,
        cor: cor,
        icone: icone,
        usuario_nome: log.nome_completo || "Usuário Removido / Sistema",
        usuario_avatar: null
    };
};

// --- ROTA 1: RENDERIZAÇÃO DA TELA ---
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const idUnidade = userLogado.id_unidade || userLogado.unidade_id;

        const [usuarios] = await db.query(
            "SELECT id_usuario, nome_completo FROM usuario WHERE id_unidade = ? AND ativo = 1 AND nome_completo != 'Super Admin' ORDER BY nome_completo",
            [idUnidade]
        );

        res.render("usuarios/atividades", {
            user: userLogado,
            currentPage: 'atividades',
            listaUsuarios: usuarios
        });
    } catch (error) {
        console.error("Erro ao renderizar tela:", error);
        res.status(500).send("Erro ao carregar tela.");
    }
});

// --- ROTA 2: API DE DADOS COM PAGINAÇÃO ---
router.get("/api/listar", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const idUnidade = userLogado.id_unidade || userLogado.unidade_id;

        // Filtros e Paginação
        const { id_usuario, modulo, data_inicio, page } = req.query;

        const paginaAtual = parseInt(page) || 1;
        const limitePorPagina = 10; // Definido conforme seu pedido
        const offset = (paginaAtual - 1) * limitePorPagina;

        // Construção dinâmica do WHERE
        let whereClause = "WHERE l.id_unidade = ?";
        const params = [idUnidade];

        if (id_usuario) {
            whereClause += " AND l.id_usuario = ?";
            params.push(id_usuario);
        }
        if (modulo) {
            whereClause += " AND l.tabela_afetada = ?";
            params.push(modulo);
        }
        if (data_inicio) {
            whereClause += " AND DATE(l.data_acao) = ?";
            params.push(data_inicio);
        }

        // --- QUERY 1: Buscar o Total de Registros (para calcular páginas) ---
        // Precisamos saber quantos registros existem no total com esses filtros
        const sqlCount = `SELECT COUNT(*) as total FROM log_atividade l ${whereClause}`;
        const [rowsCount] = await db.query(sqlCount, params);
        const totalRegistros = rowsCount[0].total;
        const totalPaginas = Math.ceil(totalRegistros / limitePorPagina);

        // --- QUERY 2: Buscar os Dados da Página Atual ---
        const sqlData = `
            SELECT l.*, u.nome_completo 
            FROM log_atividade l
            LEFT JOIN usuario u ON l.id_usuario = u.id_usuario
            ${whereClause}
            ORDER BY l.data_acao DESC 
            LIMIT ? OFFSET ?
        `;

        // Adicionamos limit e offset aos parametros
        const paramsData = [...params, limitePorPagina, offset];
        const [logs] = await db.query(sqlData, paramsData);

        //console.log(`[ATIVIDADES] Pág ${paginaAtual}/${totalPaginas} | Registros: ${logs.length}`);

        const logsFormatados = logs.map(log => humanizarLog(log));

        res.json({
            success: true,
            data: logsFormatados,
            pagination: {
                paginaAtual,
                totalPaginas,
                totalRegistros
            }
        });

    } catch (error) {
        console.error("Erro API Atividades:", error);
        res.status(500).json({ success: false, message: "Erro ao buscar logs" });
    }
});

module.exports = router;