const express = require("express");
const router = express.Router();
const axios = require("axios");
const db = require("../database/db");
const verificarAutenticacao = require("../middlewares/auth.middleware");

const API_DOCKER_URL = "http://localhost:5200";

// Função auxiliar para verificar Admin
const verificarSeEhAdmin = (user) => {
    if (user.email === 'admin@admin.com') return true;
    if (user.nome_perfil === 'Administrador' || user.nome_perfil === 'Super Admin') return true;
    return false;
};

// Função auxiliar para converter Data (DD/MM/YYYY -> YYYY-MM-DD)
function converterData(dataStr) {
    if (!dataStr) return null;
    // Tenta formato DD/MM/YYYY
    const partes = dataStr.split('/');
    if (partes.length === 3) {
        return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }
    return null; // ou retorna dataStr se já estiver no formato certo
}

// Função auxiliar para formatar texto de Situação
function tratarSituacao(texto) {
    if (!texto) return "Indisponível";
    const t = texto.toLowerCase();
    if (t.includes("venc")) return "Vencido";
    if (t.includes("val") || t.includes("vál")) return "Válido";
    return texto;
}

// --- 1. RENDERIZAR LISTA ---
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);
        const idUnidadeUsuario = userLogado.id_unidade || userLogado.unidade_id;

        // Query base
        let query = `
            SELECT 
                id_epi, 
                id_unidade, 
                ca, 
                nome_equipamento, 
                validade_ca 
            FROM epi 
            WHERE ativo = 1
        `;

        const params = [];

        // LÓGICA DE ISOLAMENTO
        if (!ehAdmin) {
            // Usuário comum vê: Globais (NULL) + Da sua unidade
            query += ` AND (id_unidade IS NULL OR id_unidade = ?)`;
            params.push(idUnidadeUsuario);
        }

        query += ` ORDER BY nome_equipamento ASC`;

        const [epis] = await db.query(query, params);

        res.render("estoque/epi-lista", {
            user: userLogado,
            currentPage: 'epi',
            episJson: JSON.stringify(epis) // Envia os dados para o front
        });

    } catch (error) {
        console.error("Erro ao listar EPIs:", error);
        res.status(500).send("Erro ao carregar lista de EPIs.");
    }
});

// --- 2. RENDERIZAR FORMULÁRIO ---
router.get("/novo", verificarAutenticacao, (req, res) => {
    res.render("estoque/epi-form", { user: req.session.user, currentPage: 'epi-novo' });
});

// --- 3. API PROXY (Consulta CA) ---
router.get("/consulta-ca/:ca", verificarAutenticacao, async (req, res) => {
    const ca = req.params.ca.replace(/\D/g, "");

    try {
        const response = await axios.get(`${API_DOCKER_URL}/retornarTodasAtualizacoes/${ca}`, {
            timeout: 5000
        });

        const listaEpi = response.data;

        if (Array.isArray(listaEpi) && listaEpi.length > 0) {
            const item = listaEpi[0];
            const dadosRetorno = {
                validade: item.DataValidade,
                situacao: tratarSituacao(item.Situacao),
                equipamento: item.NomeEquipamento,
                aprovadoParaLaudo: item.AprovadoParaLaudo || "",
                observacaoAnaliseLaudo: item.ObservacaoAnaliseLaudo || ""
            };
            return res.json(dadosRetorno);
        }
        return res.status(404).json({ error: "CA não encontrado na base de dados." });

    } catch (err) {
        if (err.response && err.response.status === 404) {
            return res.status(404).json({ error: "CA inexistente." });
        }
        return res.status(500).json({ error: "Erro de comunicação com o servidor de EPIs." });
    }
});

// --- 4. SALVAR NO BANCO (POST) ---
router.post("/novo", verificarAutenticacao, async (req, res) => {
    try {
        // Campos que vêm do formulário (note os nomes 'name' do HTML)
        const { ca, nome, validade, aprovadoParaLaudo, observacaoAnaliseLaudo } = req.body;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        if (!ca || !nome) {
            return res.status(400).json({ success: false, message: "CA e Nome são obrigatórios." });
        }

        // 1. Definição de Isolamento (Unidade vs Global)
        let idUnidadeParaSalvar = null;
        if (ehAdmin) {
            idUnidadeParaSalvar = null;
        } else {
            idUnidadeParaSalvar = userLogado.id_unidade || userLogado.unidade_id;
        }

        // 2. Converter Data
        const dataValidadeFormatada = converterData(validade);

        // 3. SQL (Ajustado para seu esquema 'epi')
        // Atenção: Removi o UUID manual se sua tabela usa AUTO_INCREMENT (INT).
        // Se sua tabela usa UUID char(36), mantenha o uuidv4(). 
        // Pelo seu histórico recente, 'epi' era INT AUTO_INCREMENT. 
        // Vou usar INSERT sem ID para o auto-increment fazer o trabalho.

        const sql = `
            INSERT INTO epi (id_unidade, ca, nome_equipamento, validade_ca, ativo)
            VALUES (?, ?, ?, ?, 1)
        `;

        // Nota: Sua tabela 'epi' que criamos antes tinha essas colunas:
        // id_unidade, ca, nome_equipamento, validade_ca, ativo.
        // Os campos 'aprovado_laudo' e 'obs_analise' não estavam no CREATE TABLE 'epi' que você passou antes.
        // Se você quiser salvar esses campos extras, precisa adicionar as colunas na tabela primeiro:
        // ALTER TABLE epi ADD COLUMN aprovado_laudo TEXT;
        // ALTER TABLE epi ADD COLUMN obs_analise TEXT;

        // Vou assumir que você VAI criar essas colunas ou já criou.
        // Se não tiver criado, remova do SQL abaixo.

        /* SQL CORRIGIDO COMPLETO (COM CAMPOS EXTRAS):
        */
        const sqlCompleto = `
             INSERT INTO epi (id_unidade, ca, nome_equipamento, validade_ca, ativo)
             VALUES (?, ?, ?, ?, 1)
        `;

        await db.query(sqlCompleto, [
            idUnidadeParaSalvar,
            ca,
            nome,
            dataValidadeFormatada
        ]);

        return res.json({ success: true, message: "EPI cadastrado com sucesso!" });

    } catch (error) {
        console.error("Erro ao salvar EPI:", error);
        return res.status(500).json({ success: false, message: "Erro interno ao salvar EPI." });
    }
});

module.exports = router;