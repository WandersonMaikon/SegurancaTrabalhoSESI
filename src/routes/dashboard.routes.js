const express = require("express");
const router = express.Router();
const verificarAutenticacao = require("../middlewares/auth.middleware");

router.get("/", verificarAutenticacao, (req, res) => {
    res.render("dashboard/index", {
        user: req.session.user,
        currentPage: 'dashboard'
    });
});

// Rota da Tela Inicial (Boas-vindas para usuários restritos)
router.get("/inicio", verificarAutenticacao, (req, res) => {
    // Renderiza a view apontando pra pasta dashboard
    res.render("dashboard/inicio", { 
        user: req.session.user,
        currentPage: 'inicio' // Boa prática manter isso pra marcar o menu!
    });
});

module.exports = router;