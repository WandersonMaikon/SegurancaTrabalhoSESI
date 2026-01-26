const express = require("express");
const router = express.Router();
const verificarAutenticacao = require("../middlewares/auth.middleware");

// --- EPI ---
router.get("/", verificarAutenticacao, (req, res) => {
    res.render("estoque/epis-lista", { user: req.session.user, currentPage: 'epis' });
});
router.get("/novo", verificarAutenticacao, (req, res) => {
    res.render("estoque/epis-form", { user: req.session.user, currentPage: 'epis-novo' });
});

module.exports = router;