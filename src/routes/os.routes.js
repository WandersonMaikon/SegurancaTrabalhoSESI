const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { v4: uuidv4 } = require('uuid');
const verificarAutenticacao = require("../middlewares/auth.middleware");
const verificarPermissao = require("../middlewares/permission.middleware");
const registrarLog = require("../utils/logger"); // IMPORTANTE: O Logger

// Função auxiliar para verificar se é Admin
const verificarSeEhAdmin = (user) => {
    if (user.email === 'admin@admin.com') return true;
    if (user.nome_perfil === 'Administrador' || user.nome_perfil === 'Super Admin') return true;
    return false;
};

// =============================================================================
// 1. LISTAR ORDENS DE SERVIÇO (GET)
// =============================================================================
// CORREÇÃO: Mudado de 'ordem_servico' para 'ordens_servico'
router.get("/", verificarAutenticacao, verificarPermissao('ordens_servico', 'ver'), async (req, res) => {
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

        query += ` ORDER BY os.data_abertura DESC`;

        const [ordens] = await db.query(query, params);

        res.render("servicos/os-lista", {
            user: req.session.user,
            currentPage: 'ordem-servico',
            ordensJson: JSON.stringify(ordens),
            ehAdmin: ehAdmin
        });

    } catch (error) {
        console.error("Erro ao listar OS:", error);
        res.status(500).send("Erro ao carregar Ordens de Serviço.");
    }
});

// =============================================================================
// 2. TELA DE NOVA OS (GET)
// =============================================================================
// CORREÇÃO: Mudado de 'ordem_servico' para 'ordens_servico'
router.get("/novo", verificarAutenticacao, verificarPermissao('ordens_servico', 'criar'), async (req, res) => {
    try {
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        let filtroUnidade = "";
        let paramsUnidade = [];

        if (!ehAdmin) {
            filtroUnidade = "AND id_unidade = ?";
            paramsUnidade.push(userLogado.id_unidade || userLogado.unidade_id);
        }

        // 1. Clientes (para o select)
        const [clientes] = await db.query(
            `SELECT id_cliente, nome_empresa, cnpj, industria FROM cliente WHERE deleted_at IS NULL ${filtroUnidade} ORDER BY nome_empresa ASC`,
            paramsUnidade
        );

        // 2. Serviços (para o select)
        let sqlServicos = `SELECT id_servico, nome_servico FROM servico WHERE deleted_at IS NULL AND ativo = 1`;
        let paramsServicos = [];
        if (!ehAdmin) {
            // Mostra serviços globais (NULL) OU da unidade do usuário
            sqlServicos += ` AND (id_unidade IS NULL OR id_unidade = ?)`;
            paramsServicos.push(userLogado.id_unidade || userLogado.unidade_id);
        }
        sqlServicos += ` ORDER BY nome_servico ASC`;
        const [servicos] = await db.query(sqlServicos, paramsServicos);

        // 3. Vínculos (Quem pode fazer o quê - para filtrar dinamicamente no front se quiser)
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

        res.render("servicos/os-form", {
            user: req.session.user,
            currentPage: 'ordem-servico',
            clientes: clientes,
            servicos: servicos,
            vinculosJson: JSON.stringify(vinculos)
        });

    } catch (error) {
        console.error("Erro ao carregar form OS:", error);
        res.redirect('/ordem-servico');
    }
});

// =============================================================================
// 3. SALVAR NOVA OS (POST) - COM LOG DETALHADO
// =============================================================================

router.post("/salvar", verificarAutenticacao, verificarPermissao('ordens_servico', 'criar'), async (req, res) => {
    let connection;
    try {
        const data = req.body;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        // CORREÇÃO AQUI: Retiramos o valor_total_contrato da validação obrigatória
        if (!data.contratante_id || !data.contrato_numero) {
            return res.status(400).json({ success: false, message: "Preencha a Empresa e o Número do Contrato." });
        }

        // Definição da Unidade da OS
        let idUnidadeOS = null;
        let nomeClienteLog = "Desconhecido";

        if (ehAdmin) {
            const [clienteRows] = await db.query("SELECT id_unidade, nome_empresa FROM cliente WHERE id_cliente = ?", [data.contratante_id]);
            if (clienteRows.length > 0) {
                idUnidadeOS = clienteRows[0].id_unidade;
                nomeClienteLog = clienteRows[0].nome_empresa;
            } else {
                return res.status(400).json({ success: false, message: "Cliente inválido." });
            }
        } else {
            idUnidadeOS = userLogado.id_unidade || userLogado.unidade_id;
            // Busca o nome do cliente apenas para o log
            const [cRows] = await db.query("SELECT nome_empresa FROM cliente WHERE id_cliente = ?", [data.contratante_id]);
            if (cRows.length > 0) nomeClienteLog = cRows[0].nome_empresa;
        }

        // CORREÇÃO AQUI: Proteção para não dar erro de .replace() se o campo vier vazio
        let valorLimpo = data.valor_total_contrato ? data.valor_total_contrato.toString().replace("R$", "").replace(/\./g, "").replace(",", ".").trim() : 0;
        let valorFomentoLimpo = data.valor_previsto_fomento ? data.valor_previsto_fomento.toString().replace("R$", "").replace(/\./g, "").replace(",", ".").trim() : 0;

        const idOS = uuidv4();

        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Inserir OS Cabeçalho
        await connection.query(
            `INSERT INTO ordem_servico (
                id_ordem_servico, id_unidade, contrato_numero, id_cliente, 
                valor_total_contrato, valor_previsto_fomento, data_abertura, status, criado_por
            ) VALUES (?, ?, ?, ?, ?, ?, NOW(), 'Aberta', ?)`,
            [idOS, idUnidadeOS, data.contrato_numero, data.contratante_id, valorLimpo, valorFomentoLimpo, userLogado.id_usuario]
        );

        // 2. Inserir Itens do Escopo
        let itens = [];
        if (data.escopo) {
            if (Array.isArray(data.escopo)) itens = data.escopo;
            else if (typeof data.escopo === 'object') itens = Object.values(data.escopo);
        }

        for (const item of itens) {
            if (item.servico_id && item.responsavel_id) {
                const prazoDias = item.prazo_execucao_dias ? parseInt(item.prazo_execucao_dias) : 1;
                const qtd = item.quantidade ? parseFloat(item.quantidade) : 1;

                await connection.query(
                    `INSERT INTO ordem_servico_item (
                        id_item, id_ordem_servico, id_servico, id_responsavel_execucao, quantidade, status_item, prazo_execucao_dias
                    ) VALUES (?, ?, ?, ?, ?, 'Pendente', ?)`,
                    [uuidv4(), idOS, item.servico_id, item.responsavel_id, qtd, prazoDias]
                );
            }
        }

        await connection.commit();

        // 3. LOG DE CRIAÇÃO
        await registrarLog({
            id_unidade: userLogado.id_unidade || userLogado.unidade_id,
            id_usuario: userLogado.id_usuario,
            acao: 'INSERT',
            tabela: 'ordem_servico',
            id_registro: idOS,
            dados_novos: {
                nome: `OS #${data.contrato_numero} - ${nomeClienteLog}`,
                contrato: data.contrato_numero,
                cliente: nomeClienteLog,
                qtd_itens: itens.length
            }
        });

        res.json({ success: true, message: "Ordem de Serviço criada com sucesso!" });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao salvar OS:", error);
        res.status(500).json({ success: false, message: "Erro interno ao salvar OS." });
    } finally {
        if (connection) connection.release();
    }
});

// =============================================================================
// 4. INATIVAR MÚLTIPLOS (POST) - COM LOG
// =============================================================================
// CORREÇÃO: Mudado de 'ordem_servico' para 'ordens_servico'
router.post("/inativar-multiplos", verificarAutenticacao, verificarPermissao('ordens_servico', 'inativar'), async (req, res) => {
    try {
        const { ids } = req.body;
        const userLogado = req.session.user;

        if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: "Nenhum registro selecionado." });

        const validIds = ids.map(id => String(id).trim()).filter(id => id.length > 0);
        const placeholders = validIds.map(() => '?').join(',');

        // 1. Busca dados antes de inativar para o log (Opcional, mas bom para saber o que foi apagado)
        const [osParaDeletar] = await db.query(`SELECT id_ordem_servico, contrato_numero FROM ordem_servico WHERE id_ordem_servico IN (${placeholders})`, validIds);

        // 2. Executa a Inativação (Soft Delete)
        const sql = `UPDATE ordem_servico SET deleted_at = NOW() WHERE id_ordem_servico IN (${placeholders})`;
        const [result] = await db.query(sql, validIds);

        // 3. LOG EM MASSA
        if (result.affectedRows > 0) {
            const promisesLog = osParaDeletar.map(async (os) => {
                return registrarLog({
                    id_unidade: userLogado.id_unidade || userLogado.unidade_id,
                    id_usuario: userLogado.id_usuario,
                    acao: 'INATIVAR',
                    tabela: 'ordem_servico',
                    id_registro: os.id_ordem_servico,
                    dados_novos: {
                        status: 'Inativo',
                        contrato: os.contrato_numero
                    }
                });
            });
            await Promise.all(promisesLog);
        }

        return res.json({ success: true, message: "Registros inativados." });

    } catch (error) {
        console.error("Erro ao inativar OS:", error);
        return res.status(500).json({ success: false, message: "Erro interno." });
    }
});

// =============================================================================
// 5. VISUALIZAR OS (GET)
// =============================================================================
// CORREÇÃO: Mudado de 'ordem_servico' para 'ordens_servico'
router.get("/ver/:id", verificarAutenticacao, verificarPermissao('ordens_servico', 'ver'), async (req, res) => {
    try {
        const { id } = req.params;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        // 1. Buscar Cabeçalho da OS
        // Adicionando verificação de unidade se não for admin
        let sqlOS = `
            SELECT os.*, c.nome_empresa, c.cnpj
            FROM ordem_servico os
            JOIN cliente c ON os.id_cliente = c.id_cliente
            WHERE os.id_ordem_servico = ?
        `;
        const paramsOS = [id];

        if (!ehAdmin) {
            sqlOS += ` AND os.id_unidade = ?`;
            paramsOS.push(userLogado.id_unidade || userLogado.unidade_id);
        }

        const [rows] = await db.query(sqlOS, paramsOS);

        if (rows.length === 0) {
            return res.status(404).send("Ordem de Serviço não encontrada ou acesso negado.");
        }
        const ordem = rows[0];

        // 2. Buscar Itens do Escopo
        const [itens] = await db.query(`
            SELECT osi.*, s.nome_servico, u.nome_completo as nome_responsavel
            FROM ordem_servico_item osi
            JOIN servico s ON osi.id_servico = s.id_servico
            JOIN usuario u ON osi.id_responsavel_execucao = u.id_usuario
            WHERE osi.id_ordem_servico = ?
        `, [id]);

        res.render("servicos/os-ver", {
            user: req.session.user,
            currentPage: 'ordem-servico',
            os: ordem,
            itens: itens
        });

    } catch (error) {
        console.error("Erro ao visualizar OS:", error);
        res.redirect('/ordem-servico');
    }
});

// =============================================================================
// 6. TELA DE EDITAR OS (GET)
// =============================================================================
router.get("/editar/:id", verificarAutenticacao, verificarPermissao('ordens_servico', 'editar'), async (req, res) => {
    try {
        const { id } = req.params;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        // 1. Busca Cabeçalho da OS
        let sqlOS = `
            SELECT os.*, c.nome_empresa, c.cnpj, c.industria
            FROM ordem_servico os
            JOIN cliente c ON os.id_cliente = c.id_cliente
            WHERE os.id_ordem_servico = ? AND os.deleted_at IS NULL
        `;
        const paramsOS = [id];

        if (!ehAdmin) {
            sqlOS += ` AND os.id_unidade = ?`;
            paramsOS.push(userLogado.id_unidade || userLogado.unidade_id);
        }

        const [rows] = await db.query(sqlOS, paramsOS);

        if (rows.length === 0) {
            return res.status(404).send("Ordem de Serviço não encontrada ou acesso negado.");
        }
        const ordem = rows[0];

        // 2. Busca Itens do Escopo já cadastrados
        const [itens] = await db.query(`
            SELECT osi.*, s.nome_servico, u.nome_completo as nome_responsavel
            FROM ordem_servico_item osi
            JOIN servico s ON osi.id_servico = s.id_servico
            JOIN usuario u ON osi.id_responsavel_execucao = u.id_usuario
            WHERE osi.id_ordem_servico = ?
        `, [id]);

        // Anexa o escopo dentro da OS para o Front-end
        ordem.escopo = itens;

        // 3. Buscas para os modais (Serviços e Responsáveis)
        let sqlServicos = `SELECT id_servico, nome_servico FROM servico WHERE deleted_at IS NULL AND ativo = 1`;
        let paramsServicos = [];
        if (!ehAdmin) {
            sqlServicos += ` AND (id_unidade IS NULL OR id_unidade = ?)`;
            paramsServicos.push(userLogado.id_unidade || userLogado.unidade_id);
        }
        sqlServicos += ` ORDER BY nome_servico ASC`;
        const [servicos] = await db.query(sqlServicos, paramsServicos);

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

        // Chama o EJS da tela de edição
        res.render("servicos/os-editar", {
            user: req.session.user,
            currentPage: 'ordem-servico',
            os: ordem,          // Passa a OS (agora com o escopo dentro)
            servicos: servicos,
            vinculosJson: JSON.stringify(vinculos)
        });

    } catch (error) {
        console.error("Erro ao carregar edição de OS:", error);
        res.redirect('/ordem-servico');
    }
});

// =============================================================================
// 7. SALVAR EDIÇÃO DA OS (POST)
// =============================================================================
router.post("/editar/:id", verificarAutenticacao, verificarPermissao('ordens_servico', 'editar'), async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        const data = req.body;
        const userLogado = req.session.user;

        // Limpa a formatação de dinheiro
        let valorLimpo = data.valor_total_contrato ? data.valor_total_contrato.toString().replace("R$", "").replace(/\./g, "").replace(",", ".").trim() : 0;
        let valorFomentoLimpo = data.valor_previsto_fomento ? data.valor_previsto_fomento.toString().replace("R$", "").replace(/\./g, "").replace(",", ".").trim() : 0;

        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Atualizar OS Cabeçalho
        // A MÁGICA: Veja que "contrato_numero" e "id_cliente" NÃO ESTÃO neste UPDATE!
        // Portanto, são intocáveis e impossíveis de serem editados.
        await connection.query(
            `UPDATE ordem_servico 
             SET valor_total_contrato = ?, valor_previsto_fomento = ?
             WHERE id_ordem_servico = ?`,
            [valorLimpo, valorFomentoLimpo, id]
        );

        // 2. Wipe and Replace (Apaga e Recria) nos Itens do Escopo
        await connection.query(`DELETE FROM ordem_servico_item WHERE id_ordem_servico = ?`, [id]);

        let itens = [];
        if (data.escopo) {
            if (Array.isArray(data.escopo)) itens = data.escopo;
            else if (typeof data.escopo === 'object') itens = Object.values(data.escopo);
        }

        for (const item of itens) {
            if (item.servico_id && item.responsavel_id) {
                const prazoDias = item.prazo_execucao_dias ? parseInt(item.prazo_execucao_dias) : 1;
                const qtd = item.quantidade ? parseFloat(item.quantidade) : 1;
                const statusItem = item.status_item || 'Pendente'; // Mantém o status pendente para novos itens editados

                await connection.query(
                    `INSERT INTO ordem_servico_item (
                        id_item, id_ordem_servico, id_servico, id_responsavel_execucao, quantidade, status_item, prazo_execucao_dias
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [uuidv4(), id, item.servico_id, item.responsavel_id, qtd, statusItem, prazoDias]
                );
            }
        }

        // 3. LOG DE EDIÇÃO
        await registrarLog({
            id_unidade: userLogado.id_unidade || userLogado.unidade_id,
            id_usuario: userLogado.id_usuario,
            acao: 'UPDATE',
            tabela: 'ordem_servico',
            id_registro: id,
            dados_novos: {
                mensagem: "OS atualizada com sucesso.",
                novos_valores: {
                    valor_total_contrato: valorLimpo,
                    valor_previsto_fomento: valorFomentoLimpo
                },
                qtd_itens_escopo: itens.length
            }
        });

        await connection.commit();
        res.json({ success: true, message: "Ordem de Serviço atualizada com sucesso!" });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao atualizar OS:", error);
        res.status(500).json({ success: false, message: "Erro interno ao atualizar OS." });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;