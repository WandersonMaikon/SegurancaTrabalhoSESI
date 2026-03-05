const express = require("express");
const router = express.Router();
const verificarAutenticacao = require("../middlewares/auth.middleware");

// Rota para a página de Normas Regulamentadoras (NR)
router.get("/", verificarAutenticacao, (req, res) => {
    res.render("normas/nrs", { // Ajuste o caminho conforme a pasta onde você for salvar o EJS
        user: req.session.user,
        currentPage: 'normas-nr' // Variável para manter o menu ativo na sidebar
    });
});

module.exports = router;