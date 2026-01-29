const express = require("express");
const router = express.Router();
const axios = require("axios");
const { v4: uuidv4 } = require('uuid');
const db = require("../database/db");
const verificarAutenticacao = require("../middlewares/auth.middleware");

// URL da API Docker (Confirmada)
const API_DOCKER_URL = "http://localhost:5200";

// --- 1. RENDERIZAR LISTA ---
router.get("/", verificarAutenticacao, (req, res) => {
    res.render("estoque/epis-lista", { user: req.session.user, currentPage: 'epis' });
});

// --- 2. RENDERIZAR FORMULÁRIO ---
router.get("/novo", verificarAutenticacao, (req, res) => {
    res.render("estoque/epis-form", { user: req.session.user, currentPage: 'epis-novo' });
});

// --- 3. API PROXY (Consulta CA) ---
router.get("/consulta-ca/:ca", verificarAutenticacao, async (req, res) => {
    // Remove qualquer coisa que não seja número
    const ca = req.params.ca.replace(/\D/g, "");


    try {
        const response = await axios.get(`${API_DOCKER_URL}/retornarTodasAtualizacoes/${ca}`, {
            timeout: 5000 // Timeout de 5 segundos para não travar
        });

        const listaEpi = response.data;

        // Verifica se retornou um array com dados
        if (Array.isArray(listaEpi) && listaEpi.length > 0) {
            const item = listaEpi[0]; // Pega o primeiro item do array

            // Mapeamento exato baseada no JSON que você mandou
            const dadosRetorno = {
                validade: item.DataValidade,          // Ex: "08/07/2007"
                situacao: tratarSituacao(item.Situacao), // Ex: "VENCIDO" -> "Vencido"
                equipamento: item.NomeEquipamento,    // Ex: "PERNEIRA"
                aprovadoParaLaudo: item.AprovadoParaLaudo || "",
                observacaoAnaliseLaudo: item.ObservacaoAnaliseLaudo || ""
            };

            return res.json(dadosRetorno);
        }

        // Se o array vier vazio
        return res.status(404).json({ error: "CA não encontrado na base de dados." });

    } catch (err) {
        // Se o Docker responder 404
        if (err.response && err.response.status === 404) {
            return res.status(404).json({ error: "CA inexistente." });
        }

        return res.status(500).json({ error: "Erro de comunicação com o servidor de EPIs." });
    }
});

// --- 4. SALVAR NO BANCO (POST) ---
router.post("/novo", verificarAutenticacao, async (req, res) => {
    try {
        const { ca, nome, validade, aprovadoParaLaudo, observacaoAnaliseLaudo } = req.body;

        // IMPORTANTE: Se o seu banco pede data no formato YYYY-MM-DD, 
        // precisamos converter "08/07/2007" para "2007-07-08".
        // Se o campo no banco for VARCHAR, pode salvar direto.

        const idEpi = uuidv4();

        // Ajuste o SQL conforme o nome real das suas colunas no banco MySQL
        const sql = `
            INSERT INTO epi (id_epi, ca, nome_equipamento, data_validade, aprovado_laudo, obs_analise)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        await db.execute(sql, [
            idEpi,
            ca,
            nome,
            validade, // Se der erro de data, me avise que criamos um conversor
            aprovadoParaLaudo,
            observacaoAnaliseLaudo
        ]);

        // Redireciona para a lista após salvar
        res.redirect('/epi');

    } catch (error) {
        
        res.status(500).send("Erro ao salvar EPI. Verifique o log.");
    }
});

// --- Função Auxiliar para formatar texto ---
function tratarSituacao(texto) {
    if (!texto) return "Indisponível";
    const t = texto.toLowerCase();
    if (t.includes("venc")) return "Vencido";
    if (t.includes("val") || t.includes("vál")) return "Válido";
    return texto; // Retorna o original se não for nem válido nem vencido
}

module.exports = router;