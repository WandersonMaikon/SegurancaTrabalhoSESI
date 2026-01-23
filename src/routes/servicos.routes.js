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



module.exports = router;