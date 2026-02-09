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
    let cor = "primary"; // primary, green-500, red-500, etc.
    let icone = "file-text";

    // Mapeamento de nomes técnicos para nomes amigáveis
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

    const camposLegiveis = {
        'nome': 'Nome',
        'cnpj': 'CNPJ',
        'email': 'E-mail',
        'telefone': 'Telefone',
        'industria': 'Indústria',
        'cartao': 'Cartão',
        'unidade': 'Unidade',
        'endereco': 'Endereço',
        'status': 'Status'
    };

    const nomeTabela = tabelas[log.tabela_afetada] ||
        (log.tabela_afetada ? log.tabela_afetada.charAt(0).toUpperCase() + log.tabela_afetada.slice(1) : "Sistema");

    // Parse seguro dos dados
    let dados = {};
    if (log.dados_novos) {
        try {
            dados = typeof log.dados_novos === 'string' ? JSON.parse(log.dados_novos) : log.dados_novos;
        } catch (e) { dados = {}; }
    }

    // --- LÓGICA DE FORMATAÇÃO ---

    if (log.acao === 'INSERT') {
        titulo = `Criou um novo registro em <strong>${nomeTabela}</strong>`;
        cor = "green-500";
        icone = "plus";

        // Tenta pegar o nome do item criado para mostrar no título
        const nomeItem = dados.nome || dados.nome_risco || dados.nome_empresa || dados.titulo;
        if (nomeItem) {
            titulo = `Cadastrou <strong>${nomeItem}</strong> em ${nomeTabela}`;
        }

    } else if (log.acao === 'UPDATE') {
        titulo = `Atualizou informações em <strong>${nomeTabela}</strong>`;
        cor = "sky-500";
        icone = "edit";

        // LÓGICA MELHORADA PARA DETALHES DE EDIÇÃO
        if (dados && Object.keys(dados).length > 0) {
            const alteracoes = [];

            // Verifica se é apenas uma mudança de status simples
            if (dados.status && typeof dados.status === 'string') {
                titulo = `Alterou status para <span class="text-${cor} font-bold">${dados.status}</span>`;
            }
            // Verifica se é o nosso objeto de comparação {de, para}
            else {
                for (const [key, value] of Object.entries(dados)) {
                    // Se o valor for um objeto com "de" e "para"
                    if (value && typeof value === 'object' && 'para' in value) {
                        const nomeCampo = camposLegiveis[key] || key;
                        const valorPara = value.para === null || value.para === '' ? 'Vazio' : value.para;
                        alteracoes.push(`${nomeCampo}`);
                    }
                    // Se for string direta (ex: endereco: "Dados atualizados")
                    else if (typeof value === 'string') {
                        const nomeCampo = camposLegiveis[key] || key;
                        alteracoes.push(value); // Ex: "Dados de endereço atualizados"
                    }
                }

                if (alteracoes.length > 0) {
                    // Exemplo: "Alterou Nome, Telefone em Cliente"
                    titulo = `Alterou <strong>${alteracoes.join(', ')}</strong> em ${nomeTabela}`;
                }
            }
        }

    } else if (log.acao === 'DELETE' || log.acao === 'INATIVAR') {
        titulo = `Inativou/Removeu um registro em <strong>${nomeTabela}</strong>`;
        cor = "red-500";
        icone = "trash";

        if (dados && dados.status) {
            titulo += ` <span class="text-xs text-zinc-400">(${dados.status})</span>`;
        }

    } else if (log.acao === 'LOGIN') {
        titulo = "Realizou login no sistema";
        cor = "zinc-500";
        icone = "log-in";
    }

    return {
        titulo: titulo,
        hora: formatarHora(log.data_acao),
        data_full: log.data_acao,
        cor: cor,
        icone: icone,
        usuario_nome: log.nome_completo || "Usuário Removido / Sistema",
        tabela: log.tabela_afetada
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
        const limitePorPagina = 10;
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

        // QUERY 1: Total (Count)
        const sqlCount = `SELECT COUNT(*) as total FROM log_atividade l ${whereClause}`;
        const [rowsCount] = await db.query(sqlCount, params);
        const totalRegistros = rowsCount[0].total;
        const totalPaginas = Math.ceil(totalRegistros / limitePorPagina);

        // QUERY 2: Dados (Select)
        const sqlData = `
            SELECT l.*, u.nome_completo 
            FROM log_atividade l
            LEFT JOIN usuario u ON l.id_usuario = u.id_usuario
            ${whereClause}
            ORDER BY l.data_acao DESC 
            LIMIT ? OFFSET ?
        `;

        const paramsData = [...params, limitePorPagina, offset];
        const [logs] = await db.query(sqlData, paramsData);

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