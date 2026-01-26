const express = require("express");
const router = express.Router();
const verificarAutenticacao = require("../middlewares/auth.middleware");

// --- RISCO ---
router.get("/", verificarAutenticacao, (req, res) => {
    res.render("estoque/risco-lista", { user: req.session.user, currentPage: 'risco' });
});
router.get("/novo", verificarAutenticacao, (req, res) => {
    res.render("estoque/risco-form", { user: req.session.user, currentPage: 'risco-novo' });
});

module.exports = router;