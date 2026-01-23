const express = require("express");
const router = express.Router();
const verificarAutenticacao = require("../middlewares/auth.middleware");

// --- ORDENS DE SERVIÇO  ---

router.get("/", verificarAutenticacao, (req, res) => {
    res.render("servicos/os-lista", {
        user: req.session.user,
        currentPage: 'ordem-servicos'
    });
});

router.get("/novo", verificarAutenticacao, (req, res) => {
    res.render("servicos/os-form", {
        user: req.session.user,
        currentPage: 'ordem-servicos-novo'
    });
});

module.exports = router;