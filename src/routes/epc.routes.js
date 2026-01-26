const express = require("express");
const router = express.Router();
const verificarAutenticacao = require("../middlewares/auth.middleware");

// --- EPC ---
router.get("/", verificarAutenticacao, (req, res) => {
    res.render("estoque/epc-lista", { user: req.session.user, currentPage: 'epc' });
});
router.get("/novo", verificarAutenticacao, (req, res) => {
    res.render("estoque/epc-form", { user: req.session.user, currentPage: 'epc-novo' });
});

module.exports = router;