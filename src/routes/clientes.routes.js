const express = require("express");
const router = express.Router();
const verificarAutenticacao = require("../middlewares/auth.middleware");

// Lista de Clientes (Rota: /clientes)
router.get("/", verificarAutenticacao, (req, res) => {
    res.render("clientes/cliente-lista", {
        user: req.session.user,
        currentPage: 'clientes'
    });
});

// Novo Cliente (Rota: /clientes/novo)
router.get("/novo", verificarAutenticacao, (req, res) => {
    res.render("clientes/cliente-form", {
        user: req.session.user,
        currentPage: 'clientes'
    });
});

module.exports = router;