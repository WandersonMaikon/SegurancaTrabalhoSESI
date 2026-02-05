const express = require("express");
const router = express.Router();
const db = require("../database/db");
const verificarAutenticacao = require("../middlewares/auth.middleware");

// --- FUNÇÕES AUXILIARES ---

// Formata a hora para exibir na timeline (Ex: "14:30")
const formatarHora = (dataISO) => {
    if (!dataISO) return "--:--";
    try {
        const d = new Date(dataISO);
        return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return "--:--";
    }
};

// Transforma os dados brutos do banco em algo legível para o Front-end
const humanizarLog = (log) => {
    let titulo = "";
    let cor = "primary";
    let icone = "file-text";

    // Mapa de nomes amigáveis para as tabelas
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

    // Se a tabela não estiver no mapa, usa o nome original com a primeira letra maiúscula
    const nomeTabela = tabelas[log.tabela_afetada] ||
        (log.tabela_afetada ? log.tabela_afetada.charAt(0).toUpperCase() + log.tabela_afetada.slice(1) : "Sistema");

    // --- LÓGICA DE DEFINIÇÃO DE TÍTULO, ÍCONE E COR ---

    if (log.acao === 'INSERT') {
        titulo = `Criou um novo registro em <strong>${nomeTabela}</strong>`;
        cor = "green-500";
        icone = "plus";

        // Tenta pegar o nome do item criado se disponível
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

                // Se foi atualização de status (muito comum em OS)
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

    // --- PROTEÇÃO DE RETORNO (BLINDAGEM) ---
    return {
        titulo: titulo,
        hora: formatarHora(log.data_acao),
        data_full: log.data_acao,
        cor: cor,
        icone: icone,
        // Proteção essencial: Se o usuário foi deletado (NULL), mostra um texto padrão
        usuario_nome: log.nome_completo || "Usuário Removido / Sistema",
        usuario_avatar: null
    };
};

// --- ROTA 1: RENDERIZAÇÃO DA TELA (HTML) ---
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const idUnidade = userLogado.id_unidade || userLogado.unidade_id;

        // Busca usuários apenas desta unidade para popular o filtro
        const [usuarios] = await db.query(
            "SELECT id_usuario, nome_completo FROM usuario WHERE id_unidade = ? AND ativo = 1 AND nome_completo != 'Super Admin'  ORDER BY nome_completo",
            [idUnidade]
        );

        res.render("usuarios/atividades", {
            user: userLogado,
            currentPage: 'atividades',
            listaUsuarios: usuarios
        });
    } catch (error) {
        console.error("Erro ao renderizar tela de atividades:", error);
        res.status(500).send("Erro ao carregar tela.");
    }
});

// --- ROTA 2: API DE DADOS (JSON) ---
router.get("/api/listar", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const idUnidade = userLogado.id_unidade || userLogado.unidade_id;

        // Pegando filtros da URL
        const { id_usuario, modulo, data_inicio } = req.query;
        const limit = 50;

        // Query Base
        let sql = `
            SELECT l.*, u.nome_completo 
            FROM log_atividade l
            LEFT JOIN usuario u ON l.id_usuario = u.id_usuario
            WHERE l.id_unidade = ?
        `;
        const params = [idUnidade];

        // Aplica Filtros se existirem
        if (id_usuario) {
            sql += " AND l.id_usuario = ?";
            params.push(id_usuario);
        }

        if (modulo) {
            sql += " AND l.tabela_afetada = ?";
            params.push(modulo);
        }

        if (data_inicio) {
            sql += " AND DATE(l.data_acao) = ?";
            params.push(data_inicio);
        }

        sql += " ORDER BY l.data_acao DESC LIMIT ?";
        params.push(limit);

        // Executa a busca
        const [logs] = await db.query(sql, params);

        // Debug no terminal para conferir se achou dados
        console.log(`[ATIVIDADES] Unidade: ${idUnidade} | Logs encontrados: ${logs.length}`);

        // Formata os dados
        const logsFormatados = logs.map(log => humanizarLog(log));

        res.json({ success: true, data: logsFormatados });

    } catch (error) {
        console.error("Erro API Atividades:", error);
        res.status(500).json({ success: false, message: "Erro ao buscar logs" });
    }
});

module.exports = router;