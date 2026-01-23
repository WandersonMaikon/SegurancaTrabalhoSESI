const express = require("express");
const router = express.Router();
const verificarAutenticacao = require("../middlewares/auth.middleware");

// -- Atividades --

router.get("/", verificarAutenticacao, (req, res) => {
    res.render("usuarios/atividades", {
        user: req.session.user,
        currentPage: 'atividades'
    });
});

module.exports = router;