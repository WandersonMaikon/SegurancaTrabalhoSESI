const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { v4: uuidv4 } = require('uuid');
const verificarAutenticacao = require("../middlewares/auth.middleware");
const verificarPermissao = require("../middlewares/permission.middleware");

// 1. IMPORTA O LOGGER
const registrarLog = require("../utils/logger");

// Função auxiliar Admin
const verificarSeEhAdmin = (user) => {
    if (user.email === 'admin@admin.com') return true;
    if (user.nome_perfil === 'Administrador' || user.nome_perfil === 'Super Admin') return true;
    return false;
};

// --- LISTAR CLIENTES ---
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        let query = `
            SELECT c.*, u.nome_fantasia as nome_unidade
            FROM cliente c
            JOIN unidade u ON c.id_unidade = u.id_unidade
            WHERE c.deleted_at IS NULL 
        `;

        const params = [];

        if (!ehAdmin) {
            query += ` AND c.id_unidade = ?`;
            params.push(userLogado.id_unidade || userLogado.unidade_id);
        }

        query += ` ORDER BY c.nome_empresa ASC`;

        const [clientes] = await db.query(query, params);

        res.render("clientes/cliente-lista", {
            user: req.session.user,
            currentPage: 'clientes',
            clientesJson: JSON.stringify(clientes)
        });
    } catch (error) {
        console.error("Erro ao buscar clientes:", error);
        res.status(500).send("Erro ao carregar clientes.");
    }
});

// --- FORMULÁRIO DE NOVO CLIENTE ---
router.get("/novo", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);
        let unidades = [];

        if (ehAdmin) {
            const [rows] = await db.query("SELECT id_unidade, nome_fantasia FROM unidade WHERE ativo = 1 ORDER BY nome_fantasia ASC");
            unidades = rows;
        }

        res.render("clientes/cliente-form", {
            user: req.session.user,
            currentPage: 'clientes',
            unidades: unidades,
            ehAdmin: ehAdmin
        });
    } catch (error) {
        console.error("Erro ao carregar formulário:", error);
        res.redirect("/clientes");
    }
});

// --- SALVAR NOVO CLIENTE ---
router.post("/salvar", verificarAutenticacao, async (req, res) => {
    try {
        const data = req.body;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        // 1. Validação Básica
        if (!data.nome || !data.cnpj) {
            return res.status(400).json({ success: false, message: "Preencha Nome e CNPJ." });
        }

        // 2. Validação de Unidade
        let idUnidadeFinal = null;
        if (ehAdmin) {
            if (!data.id_unidade) return res.status(400).json({ success: false, message: "Selecione a Unidade." });
            idUnidadeFinal = data.id_unidade;
        } else {
            idUnidadeFinal = userLogado.id_unidade || userLogado.unidade_id;
        }

        // 3. Validação de Duplicidade
        const [existente] = await db.query("SELECT id_cliente FROM cliente WHERE cnpj = ? AND deleted_at IS NULL", [data.cnpj]);

        if (existente.length > 0) {
            return res.status(400).json({ success: false, message: "Já existe um cliente ativo cadastrado com este CNPJ." });
        }

        const id_cliente = uuidv4();

        // --- LÓGICA: Indústria e Cartão Vantagem ---
        const ehIndustria = (data.empresa_industria == 1 || data.empresa_industria === true || data.empresa_industria === 'true' || data.empresa_industria === 'on') ? 1 : 0;

        let valorCartao = 0.00;
        if (ehIndustria === 1 && data.cartao_vantagem) {
            valorCartao = parseFloat(data.cartao_vantagem.toString().replace(',', '.'));
            if (isNaN(valorCartao)) valorCartao = 0.00;
        }

        const sql = `
            INSERT INTO cliente (
                id_cliente, id_unidade, nome_empresa, industria, cnpj, email, 
                cartao_vantagem,
                telefone, num_colaboradores, nome_representante, cpf_mf, rg_ci,
                cep, logradouro, numero, bairro, cidade, estado,
                ativo 
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            id_cliente,
            idUnidadeFinal,
            data.nome,
            ehIndustria,
            data.cnpj,
            data.email,
            valorCartao,
            data.telefone,
            data.ncolaboradores || 0,
            data.representante_nome,
            data.cpf,
            data.rg,
            data.cep,
            data.endereco,
            data.numero,
            data.bairro,
            data.cidade,
            data.estado,
            1 // Campo 'ativo'
        ];

        await db.query(sql, values);

        // --- 2. REGISTRAR LOG (INSERT) ---
        await registrarLog({
            id_unidade: userLogado.id_unidade || userLogado.unidade_id,
            id_usuario: userLogado.id_usuario,
            acao: 'INSERT',
            tabela: 'cliente',
            id_registro: id_cliente,
            dados_novos: {
                nome: data.nome,
                cnpj: data.cnpj,
                industria: ehIndustria ? 'Sim' : 'Não',
                unidade: idUnidadeFinal,
                status: 'Ativo'
            }
        });

        return res.status(200).json({ success: true, message: "Cliente cadastrado com sucesso!" });

    } catch (error) {
        console.error("Erro ao salvar cliente:", error);
        return res.status(500).json({ success: false, message: "Erro interno ao salvar cliente." });
    }
});

// =========================================================================
// ROTA: TELA DE EDITAR (GET)
// =========================================================================
router.get("/editar/:id", verificarAutenticacao, async (req, res) => {
    try {
        const { id } = req.params;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        // 1. Busca o cliente
        const [rows] = await db.query("SELECT * FROM cliente WHERE id_cliente = ? AND deleted_at IS NULL", [id]);

        if (rows.length === 0) {
            return res.status(404).send("Cliente não encontrado.");
        }

        const cliente = rows[0];

        // 2. Verifica permissão de unidade (se não for admin, só pode editar da própria unidade)
        if (!ehAdmin && cliente.id_unidade !== (userLogado.id_unidade || userLogado.unidade_id)) {
            return res.status(403).send("Acesso negado a este cliente.");
        }

        // 3. Se for Admin, busca lista de unidades para o select
        let unidades = [];
        if (ehAdmin) {
            const [uRows] = await db.query("SELECT id_unidade, nome_fantasia FROM unidade WHERE ativo = 1 ORDER BY nome_fantasia ASC");
            unidades = uRows;
        }

        res.render("clientes/cliente-editar", {
            user: userLogado,
            currentPage: 'clientes',
            cliente: cliente,
            unidades: unidades,
            ehAdmin: ehAdmin
        });

    } catch (error) {
        console.error("Erro ao abrir edição:", error);
        res.status(500).send("Erro interno.");
    }
});

// =========================================================================
// ROTA: TELA DE VER (GET - Read Only)
// =========================================================================
router.get("/ver/:id", verificarAutenticacao, async (req, res) => {
    try {
        const { id } = req.params;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        const [rows] = await db.query(`
            SELECT c.*, u.nome_fantasia as nome_unidade 
            FROM cliente c
            JOIN unidade u ON c.id_unidade = u.id_unidade
            WHERE c.id_cliente = ? AND c.deleted_at IS NULL
        `, [id]);

        if (rows.length === 0) return res.status(404).send("Cliente não encontrado.");

        const cliente = rows[0];

        if (!ehAdmin && cliente.id_unidade !== (userLogado.id_unidade || userLogado.unidade_id)) {
            return res.status(403).send("Acesso negado.");
        }

        res.render("clientes/cliente-ver", {
            user: userLogado,
            currentPage: 'clientes',
            cliente: cliente
        });

    } catch (error) {
        console.error("Erro ao ver cliente:", error);
        res.status(500).send("Erro interno.");
    }
});

// =========================================================================
// ROTA: AÇÃO DE EDITAR (POST) - COM LOG DETALHADO (DIFF)
// =========================================================================
router.post("/editar", verificarAutenticacao, async (req, res) => {
    try {
        const data = req.body;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        if (!data.id_cliente || !data.nome || !data.cnpj) {
            return res.status(400).json({ success: false, message: "Dados incompletos." });
        }

        // 1. Busca dados ANTERIORES
        const [rows] = await db.query("SELECT * FROM cliente WHERE id_cliente = ?", [data.id_cliente]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: "Cliente não existe." });

        const clienteAnterior = rows[0];

        // 2. Validação de Segurança
        if (!ehAdmin && clienteAnterior.id_unidade !== (userLogado.id_unidade || userLogado.unidade_id)) {
            return res.status(403).json({ success: false, message: "Sem permissão." });
        }

        // 3. Preparação dos dados novos
        const ehIndustria = (data.empresa_industria == 1 || data.empresa_industria === 'on' || data.empresa_industria === true) ? 1 : 0;

        let valorCartao = 0.00;
        if (ehIndustria === 1 && data.cartao_vantagem) {
            valorCartao = parseFloat(data.cartao_vantagem.toString().replace(',', '.'));
            if (isNaN(valorCartao)) valorCartao = 0.00;
        }

        let idUnidadeSalvar = clienteAnterior.id_unidade;
        if (ehAdmin && data.id_unidade) {
            idUnidadeSalvar = data.id_unidade;
        }

        // 4. Executa o UPDATE
        const sql = `
            UPDATE cliente SET 
                id_unidade = ?, nome_empresa = ?, industria = ?, cnpj = ?, email = ?, 
                cartao_vantagem = ?, telefone = ?, num_colaboradores = ?, 
                nome_representante = ?, cpf_mf = ?, rg_ci = ?, 
                cep = ?, logradouro = ?, numero = ?, bairro = ?, cidade = ?, estado = ?
            WHERE id_cliente = ?
        `;

        const values = [
            idUnidadeSalvar, data.nome, ehIndustria, data.cnpj, data.email,
            valorCartao, data.telefone, data.ncolaboradores || 0,
            data.representante_nome, data.cpf, data.rg,
            data.cep, data.endereco, data.numero, data.bairro, data.cidade, data.estado,
            data.id_cliente
        ];

        await db.query(sql, values);

        // =====================================================================
        // 5. LÓGICA DE COMPARAÇÃO (DIFF)
        // =====================================================================
        const alteracoes = {};

        // Função auxiliar para comparar valores (tratando null/undefined como iguais a string vazia)
        const mudou = (antigo, novo) => {
            const v1 = antigo == null ? "" : String(antigo).trim();
            const v2 = novo == null ? "" : String(novo).trim();
            return v1 !== v2;
        };

        if (mudou(clienteAnterior.nome_empresa, data.nome)) alteracoes.nome = { de: clienteAnterior.nome_empresa, para: data.nome };
        if (mudou(clienteAnterior.cnpj, data.cnpj)) alteracoes.cnpj = { de: clienteAnterior.cnpj, para: data.cnpj };
        if (mudou(clienteAnterior.email, data.email)) alteracoes.email = { de: clienteAnterior.email, para: data.email };
        if (mudou(clienteAnterior.telefone, data.telefone)) alteracoes.telefone = { de: clienteAnterior.telefone, para: data.telefone };
        if (Number(clienteAnterior.industria) !== ehIndustria) alteracoes.industria = { de: clienteAnterior.industria ? 'Sim' : 'Não', para: ehIndustria ? 'Sim' : 'Não' };

        // Compara Cartão (numérico)
        if (Math.abs(Number(clienteAnterior.cartao_vantagem) - valorCartao) > 0.001) {
            alteracoes.cartao = { de: Number(clienteAnterior.cartao_vantagem), para: valorCartao };
        }

        // Compara Unidade
        if (clienteAnterior.id_unidade !== idUnidadeSalvar) {
            alteracoes.unidade = { de: clienteAnterior.id_unidade, para: idUnidadeSalvar };
        }

        // Compara Endereço (Agrupado para não poluir o log se mudar tudo de uma vez)
        const mudouEndereco =
            mudou(clienteAnterior.cep, data.cep) ||
            mudou(clienteAnterior.logradouro, data.endereco) ||
            mudou(clienteAnterior.numero, data.numero);

        if (mudouEndereco) {
            alteracoes.endereco = "Dados de endereço atualizados";
        }

        // Se houve alguma alteração, registra o log
        if (Object.keys(alteracoes).length > 0) {
            await registrarLog({
                id_unidade: userLogado.id_unidade || userLogado.unidade_id,
                id_usuario: userLogado.id_usuario,
                acao: 'UPDATE',
                tabela: 'cliente',
                id_registro: data.id_cliente,
                // Aqui salvamos APENAS as diferenças no JSON
                dados_novos: alteracoes
            });
        }

        return res.status(200).json({ success: true, message: "Cliente atualizado com sucesso!" });

    } catch (error) {
        console.error("Erro ao editar cliente:", error);
        return res.status(500).json({ success: false, message: "Erro interno ao editar." });
    }
});

// --- INATIVAR MÚLTIPLOS ---
router.post("/inativar-multiplos", verificarAutenticacao, async (req, res) => {
    try {
        const { ids } = req.body;
        const userLogado = req.session.user;
        const idUnidadeUsuario = userLogado.id_unidade || userLogado.unidade_id;

        if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: "Nenhum cliente selecionado." });

        const validIds = ids.map(id => String(id).trim()).filter(id => id.length > 0);

        if (validIds.length === 0) return res.status(400).json({ success: false, message: "IDs inválidos." });

        const placeholders = validIds.map(() => '?').join(',');

        // ATENÇÃO: Mudamos para SET ativo = 0 (inativação lógica visual)
        const sql = `UPDATE cliente SET ativo = 0 WHERE id_cliente IN (${placeholders})`;

        const [result] = await db.query(sql, validIds);

        // --- 3. REGISTRAR LOG (INATIVAR/UPDATE EM MASSA) ---
        if (result.affectedRows > 0) {
            const promisesLog = validIds.map(async (idCliente) => {
                return registrarLog({
                    id_unidade: idUnidadeUsuario,
                    id_usuario: userLogado.id_usuario,
                    acao: 'INATIVAR', // Ou 'UPDATE' com obs
                    tabela: 'cliente',
                    id_registro: idCliente,
                    dados_novos: { status: 'Inativo (ativo=0)' }
                });
            });
            await Promise.all(promisesLog);
        }

        return res.status(200).json({ success: true, message: "Clientes inativados com sucesso." });
    } catch (error) {
        console.error("Erro ao inativar clientes:", error);
        return res.status(500).json({ success: false, message: "Erro interno." });
    }
});

module.exports = router;