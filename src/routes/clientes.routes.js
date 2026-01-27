const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { v4: uuidv4 } = require('uuid'); // Necessário para gerar o ID
const verificarAutenticacao = require("../middlewares/auth.middleware");

// --- Rota: Listar Clientes ---
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        const [clientes] = await db.query("SELECT * FROM cliente WHERE deleted_at IS NULL ORDER BY created_at DESC");
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

// --- Rota: Formulário de Novo Cliente ---
router.get("/novo", verificarAutenticacao, async (req, res) => {
    try {
        // Precisamos das unidades para preencher o Select
        const [unidades] = await db.query("SELECT id_unidade, nome_fantasia FROM unidade WHERE ativo = 1 ORDER BY nome_fantasia ASC");

        res.render("clientes/cliente-form", {
            user: req.session.user,
            currentPage: 'clientes',
            unidades: unidades // Enviando para a view
        });
    } catch (error) {
        console.error("Erro ao carregar formulário:", error);
        res.redirect("/clientes");
    }
});

// --- Rota: SALVAR Novo Cliente (INSERT) ---
router.post("/salvar", verificarAutenticacao, async (req, res) => {
    try {
        const data = req.body;

        // Validação básica
        if (!data.nome || !data.cnpj || !data.id_unidade) {
            return res.status(400).json({ success: false, message: "Preencha os campos obrigatórios (Unidade, Nome e CNPJ)." });
        }

        const id_cliente = uuidv4();

        // Tratamento do Checkbox (se marcado vem '1', se não, vem undefined)
        const industria = data.empresa_industria ? 1 : 0;

        const sql = `
            INSERT INTO cliente (
                id_cliente, id_unidade, nome_empresa, industria, cnpj, email, telefone,
                num_colaboradores, nome_representante, cpf_mf, rg_ci,
                cep, logradouro, numero, bairro, cidade, estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            id_cliente,
            data.id_unidade,
            data.nome,
            industria,
            data.cnpj,
            data.email,
            data.telefone,
            data.ncolaboradores || 0,
            data.representante_nome,
            data.cpf,
            data.rg,
            data.cep,
            data.endereco, // O name no form é 'endereco' para logradouro
            data.numero,
            data.bairro,
            data.cidade,
            data.estado
        ];

        await db.query(sql, values);

        return res.status(200).json({ success: true, message: "Cliente cadastrado com sucesso!" });

    } catch (error) {
        console.error("Erro ao salvar cliente:", error);
        // Verifica duplicidade de chave (ex: CNPJ único se houver constraint)
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: "Já existe um cliente com este CNPJ cadastrado." });
        }
        return res.status(500).json({ success: false, message: "Erro interno ao salvar cliente." });
    }
});

// --- Rota: Excluir Múltiplos ---
router.post("/excluir-multiplos", verificarAutenticacao, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: "Nenhum cliente selecionado." });

        const validIds = ids.map(id => String(id).trim()).filter(id => id.length > 0);
        if (validIds.length === 0) return res.status(400).json({ success: false, message: "IDs inválidos." });

        const placeholders = validIds.map(() => '?').join(',');
        const sql = `UPDATE cliente SET deleted_at = NOW() WHERE id_cliente IN (${placeholders})`;

        const [result] = await db.query(sql, validIds);

        return res.status(200).json({ success: true, message: `${result.affectedRows} cliente(s) excluído(s) com sucesso!` });
    } catch (error) {
        console.error("ERRO AO EXCLUIR:", error);
        return res.status(500).json({ success: false, message: "Erro interno ao excluir." });
    }
});

module.exports = router;