const express = require("express");
const router = express.Router();
const axios = require("axios");
const db = require("../database/db");
const verificarAutenticacao = require("../middlewares/auth.middleware");
const verificarPermissao = require("../middlewares/permission.middleware");
const registrarLog = require("../utils/logger");

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
    const partes = dataStr.split('/');
    if (partes.length === 3) return `${partes[2]}-${partes[1]}-${partes[0]}`;
    return dataStr;
}

// --- 1. LISTAR EPIs (GET) ---
// CORREÇÃO AQUI: Mudado de 'epi' para 'epis'
router.get("/", verificarAutenticacao, verificarPermissao('epis', 'ver'), async (req, res) => {
    try {
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);
        const idUnidadeUsuario = userLogado.id_unidade || userLogado.unidade_id;

        let query = `
            SELECT id_epi, id_unidade, ca, nome_equipamento, validade_ca 
            FROM epi WHERE ativo = 1
        `;

        const params = [];
        if (!ehAdmin) {
            query += ` AND (id_unidade IS NULL OR id_unidade = ?)`;
            params.push(idUnidadeUsuario);
        }

        query += ` ORDER BY nome_equipamento ASC`;

        const [epis] = await db.query(query, params);

        res.render("estoque/epi-lista", {
            user: userLogado,
            currentPage: 'epi',
            episJson: JSON.stringify(epis)
        });

    } catch (error) {
        console.error("Erro ao listar EPIs:", error);
        res.status(500).send("Erro ao carregar lista.");
    }
});

// --- 2. TELA DE NOVO (GET) ---
// CORREÇÃO AQUI: Mudado de 'epi' para 'epis'
router.get("/novo", verificarAutenticacao, verificarPermissao('epis', 'criar'), (req, res) => {
    res.render("estoque/epi-form", { user: req.session.user, currentPage: 'epi' });
});

// --- 3. TELA DE VISUALIZAR (GET) ---
// CORREÇÃO AQUI: Mudado de 'epi' para 'epis'
router.get("/ver/:id", verificarAutenticacao, verificarPermissao('epis', 'ver'), async (req, res) => {
    try {
        const { id } = req.params;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        const [rows] = await db.query("SELECT * FROM epi WHERE id_epi = ?", [id]);
        if (rows.length === 0) return res.status(404).send("EPI não encontrado.");

        const epi = rows[0];

        if (!ehAdmin && epi.id_unidade !== null && epi.id_unidade !== (userLogado.id_unidade || userLogado.unidade_id)) {
            return res.status(403).send("Acesso negado.");
        }

        // Lógica de Data e Status no Backend
        let dataFormatada = "-";
        let statusTexto = "Indefinido";
        let statusClass = "text-zinc-400";
        let statusIcon = "help-circle";

        if (epi.validade_ca) {
            const d = new Date(epi.validade_ca);
            const dia = String(d.getUTCDate()).padStart(2, '0');
            const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
            const ano = d.getUTCFullYear();
            dataFormatada = `${dia}/${mes}/${ano}`;

            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const dataValidade = new Date(ano, Number(mes) - 1, dia);

            if (dataValidade < hoje) {
                statusTexto = "VENCIDO";
                statusClass = "text-red-600 dark:text-red-400";
                statusIcon = "x-circle";
            } else {
                statusTexto = "VÁLIDO";
                statusClass = "text-green-600 dark:text-green-400";
                statusIcon = "check-circle-2";
            }
        }

        epi.viewData = dataFormatada;
        epi.viewStatus = statusTexto;
        epi.viewClass = statusClass;
        epi.viewIcon = statusIcon;

        res.render("estoque/epi-ver", {
            user: userLogado,
            currentPage: 'epi',
            epi: epi
        });

    } catch (error) {
        console.error("Erro ao carregar visualização:", error);
        res.redirect('/epi');
    }
});

// --- 4. API PROXY ---
router.get("/consulta-ca/:ca", verificarAutenticacao, async (req, res) => {
    // Consulta pública não costuma exigir permissão estrita de módulo, mas se quiser pode adicionar
    const ca = req.params.ca.replace(/\D/g, "");
    try {
        const response = await axios.get(`${API_DOCKER_URL}/retornarTodasAtualizacoes/${ca}`, { timeout: 5000 });
        const listaEpi = response.data;

        if (Array.isArray(listaEpi) && listaEpi.length > 0) {
            const item = listaEpi[0];
            const tratarSituacao = (t) => {
                if (!t) return "Indisponível";
                const txt = t.toLowerCase();
                if (txt.includes("venc")) return "Vencido";
                if (txt.includes("val") || txt.includes("vál")) return "Válido";
                return t;
            };

            return res.json({
                validade: item.DataValidade,
                situacao: tratarSituacao(item.Situacao),
                equipamento: item.NomeEquipamento
            });
        }
        return res.status(404).json({ error: "CA não encontrado." });
    } catch (err) {
        return res.status(500).json({ error: "Erro na consulta externa." });
    }
});

// --- 5. SALVAR NOVO (POST) ---
// CORREÇÃO AQUI: Mudado de 'epi' para 'epis'
router.post("/novo", verificarAutenticacao, verificarPermissao('epis', 'criar'), async (req, res) => {
    try {
        const { ca, nome, validade } = req.body;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        if (!ca || !nome) return res.status(400).json({ success: false, message: "Campos obrigatórios." });

        const idUnidade = ehAdmin ? null : (userLogado.id_unidade || userLogado.unidade_id);
        const dataValidade = converterData(validade);

        const [result] = await db.query(
            `INSERT INTO epi (id_unidade, ca, nome_equipamento, validade_ca, ativo) VALUES (?, ?, ?, ?, 1)`,
            [idUnidade, ca, nome, dataValidade]
        );

        await registrarLog({
            id_unidade: userLogado.id_unidade || userLogado.unidade_id,
            id_usuario: userLogado.id_usuario,
            acao: 'INSERT',
            tabela: 'epi',
            id_registro: result.insertId,
            dados_novos: {
                nome: nome,
                ca: ca,
                validade: validade
            }
        });

        return res.json({ success: true, message: "EPI cadastrado!" });

    } catch (error) {
        console.error("Erro ao salvar EPI:", error);
        return res.status(500).json({ success: false, message: "Erro interno." });
    }
});

// --- 6. INATIVAR MÚLTIPLOS (POST) ---
// CORREÇÃO AQUI: Mudado de 'epi' para 'epis' e ação 'inativar'
router.post("/inativar-multiplos", verificarAutenticacao, verificarPermissao('epis', 'inativar'), async (req, res) => {
    try {
        const { ids } = req.body;
        const userLogado = req.session.user;

        if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: "Nada selecionado." });

        const validIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));
        if (validIds.length === 0) return res.status(400).json({ success: false, message: "IDs inválidos." });

        const placeholders = validIds.map(() => '?').join(',');

        const [episParaLog] = await db.query(`SELECT id_epi, nome_equipamento, ca FROM epi WHERE id_epi IN (${placeholders})`, validIds);

        await db.query(`UPDATE epi SET ativo = 0 WHERE id_epi IN (${placeholders})`, validIds);

        const promises = episParaLog.map(async (epi) => {
            return registrarLog({
                id_unidade: userLogado.id_unidade || userLogado.unidade_id,
                id_usuario: userLogado.id_usuario,
                acao: 'INATIVAR',
                tabela: 'epi',
                id_registro: epi.id_epi,
                dados_novos: { nome: `${epi.nome_equipamento} (CA: ${epi.ca})` }
            });
        });
        await Promise.all(promises);

        return res.json({ success: true, message: "EPIs inativados." });

    } catch (error) {
        console.error("Erro inativar EPI:", error);
        return res.status(500).json({ success: false, message: "Erro interno." });
    }
});

module.exports = router;