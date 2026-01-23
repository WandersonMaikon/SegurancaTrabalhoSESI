const express = require("express");
const router = express.Router();
const verificarAutenticacao = require("../middlewares/auth.middleware");

// --- RISCO ---
router.get("/risco", verificarAutenticacao, (req, res) => {
    res.render("estoque/risco-lista", { user: req.session.user, currentPage: 'risco' });
});
router.get("/risco/novo", verificarAutenticacao, (req, res) => {
    res.render("estoque/risco-form", { user: req.session.user, currentPage: 'risco-novo' });
});

// --- EPI ---
router.get("/epi", verificarAutenticacao, (req, res) => {
    res.render("estoque/epis-lista", { user: req.session.user, currentPage: 'epis' });
});
router.get("/epi/novo", verificarAutenticacao, (req, res) => {
    res.render("estoque/epis-form", { user: req.session.user, currentPage: 'epis-novo' });
});

// --- EPC ---
router.get("/epc", verificarAutenticacao, (req, res) => {
    res.render("estoque/epc-lista", { user: req.session.user, currentPage: 'epc' });
});
router.get("/epc/novo", verificarAutenticacao, (req, res) => {
    res.render("estoque/epc-form", { user: req.session.user, currentPage: 'epc-novo' });
});

module.exports = router;