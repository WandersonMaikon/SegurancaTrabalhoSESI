const express = require("express");
const router = express.Router();
const verificarAutenticacao = require("../middlewares/auth.middleware");

// --- SERVIÇOS ---
router.get("/", verificarAutenticacao, (req, res) => {
    res.render("servicos/servico-lista", {
        user: req.session.user,
        currentPage: 'servicos'
    });
});

router.get("/novo", verificarAutenticacao, (req, res) => {
    res.render("servicos/servico-form", {
        user: req.session.user,
        currentPage: 'servicos'
    });
});

// --- ORDENS DE SERVIÇO (Rotas aninhadas) ---
// Como no server.js vamos definir o prefixo /servicos, essas rotas ficarão:
// /servicos/ordem-servico
router.get("/ordem-servico", verificarAutenticacao, (req, res) => {
    res.render("servicos/os-lista", {
        user: req.session.user,
        currentPage: 'ordemservicos'
    });
});

router.get("/ordem-servico/novo", verificarAutenticacao, (req, res) => {
    res.render("servicos/os-form", {
        user: req.session.user,
        currentPage: 'ordem-servicos-novo'
    });
});

module.exports = router;