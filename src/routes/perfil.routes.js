const express = require("express");
const router = express.Router();
const verificarAutenticacao = require("../middlewares/auth.middleware");

// -- Perfil --
router.get("/", verificarAutenticacao, (req, res) => {
    res.render("usuarios/perfil-lista", {
        user: req.session.user,
        currentPage: 'perfil'
    });
});

router.get("/novo", verificarAutenticacao, (req, res) => {
    res.render("usuarios/perfil-form", {
        user: req.session.user,
        currentPage: 'perfil-novo'
    });
});

module.exports = router;