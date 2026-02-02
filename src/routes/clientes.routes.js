const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { v4: uuidv4 } = require('uuid');
const verificarAutenticacao = require("../middlewares/auth.middleware");
const verificarPermissao = require("../middlewares/permission.middleware");

// Função auxiliar Admin
const verificarSeEhAdmin = (user) => {
    if (user.email === 'admin@admin.com') return true;
    if (user.nome_perfil === 'Administrador' || user.nome_perfil === 'Super Admin') return true;
    return false;
};

// --- LISTAR CLIENTES (Mantido original) ---
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

// --- FORMULÁRIO DE NOVO CLIENTE (Mantido original) ---
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

// --- SALVAR NOVO CLIENTE (ALTERADO AQUI) ---
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

        // 3. Validação de Duplicidade (CNPJ)
        const [existente] = await db.query("SELECT id_cliente FROM cliente WHERE cnpj = ?", [data.cnpj]);

        if (existente.length > 0) {
            return res.status(400).json({ success: false, message: "Já existe um cliente cadastrado com este CNPJ." });
        }

        const id_cliente = uuidv4();

        // --- LÓGICA NOVA: Indústria e Cartão Vantagem ---
        // Verifica se é indústria (checkbox html manda 'on' ou true, se vazio é false)
        const ehIndustria = (data.empresa_industria === true || data.empresa_industria === 'true' || data.empresa_industria === 'on') ? 1 : 0;

        let valorCartao = 0.00;
        if (ehIndustria === 1 && data.cartao_vantagem) {
            // Converte virgula para ponto e transforma em numero
            valorCartao = parseFloat(data.cartao_vantagem.toString().replace(',', '.'));
            if (isNaN(valorCartao)) valorCartao = 0.00;
        }
        // ------------------------------------------------

        const sql = `
            INSERT INTO cliente (
                id_cliente, id_unidade, nome_empresa, industria, cnpj, email, 
                cartao_vantagem, -- COLUNA NOVA
                telefone, num_colaboradores, nome_representante, cpf_mf, rg_ci,
                cep, logradouro, numero, bairro, cidade, estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            id_cliente,
            idUnidadeFinal,
            data.nome,
            ehIndustria,
            data.cnpj,
            data.email,
            valorCartao, // VALOR NOVO
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
            data.estado
        ];

        await db.query(sql, values);

        return res.status(200).json({ success: true, message: "Cliente cadastrado com sucesso!" });

    } catch (error) {
        console.error("Erro ao salvar cliente:", error);
        return res.status(500).json({ success: false, message: "Erro interno ao salvar cliente." });
    }
});

// --- Inativar Múltiplos (Mantido igual) ---
router.post("/inativar-multiplos", verificarAutenticacao, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: "Nenhum cliente selecionado." });
        const validIds = ids.map(id => String(id).trim()).filter(id => id.length > 0);
        const placeholders = validIds.map(() => '?').join(',');
        const sql = `UPDATE cliente SET deleted_at = NOW() WHERE id_cliente IN (${placeholders})`;
        await db.query(sql, validIds);
        return res.status(200).json({ success: true, message: "Clientes inativados." });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Erro interno." });
    }
});

module.exports = router;