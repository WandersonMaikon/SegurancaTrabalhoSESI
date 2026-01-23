const express = require("express");
const router = express.Router();
const verificarAutenticacao = require("../middlewares/auth.middleware");

// Lista Usuários
router.get("/", verificarAutenticacao, (req, res) => {
    res.render("usuarios/usuario-lista", {
        user: req.session.user,
        currentPage: 'usuario'
    });
});

router.get("/novo", verificarAutenticacao, (req, res) => {
    res.render("usuarios/usuario-form", {
        user: req.session.user,
        currentPage: 'usuario-novo'
    });
});

// Perfil
router.get("/perfil", verificarAutenticacao, (req, res) => {
    res.render("usuarios/perfil-lista", {
        user: req.session.user,
        currentPage: 'perfil'
    });
});

router.get("/perfil/novo", verificarAutenticacao, (req, res) => {
    res.render("usuarios/perfil-form", {
        user: req.session.user,
        currentPage: 'perfil-novo'
    });
});

router.get("/atividades", verificarAutenticacao, (req, res) => {
    res.render("usuarios/atividades", {
        user: req.session.user,
        currentPage: 'atividades'
    });
});

module.exports = router;