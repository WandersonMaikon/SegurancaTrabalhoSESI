const express = require("express");
const router = express.Router();

const verificarAutenticacao = (req, res, next) => {
    if (!req.session.user) return res.redirect("/login");
    next();
};

router.get("/login", (req, res) => {
    const message = req.session.message || "";
    req.session.message = "";
    res.render("login", { message });
});

router.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (email === "admin@admin.com" && password === "123456") {
        req.session.user = { email };
        return res.redirect("/dashboard");
    }

    req.session.message = "Usuário ou senha inválidos";
    return res.redirect("/login");
});

router.get("/dashboard", verificarAutenticacao, (req, res) => {
    res.render("dashboard", { user: req.session.user });
});

router.get("/clientes", verificarAutenticacao, (req, res) => {
    res.render("clientes", { user: req.session.user });
});

router.get("/clientes/novo", verificarAutenticacao, (req, res) => {
    res.render("cliente-novo", { user: req.session.user });
});

router.get("/servicos", verificarAutenticacao, (req, res) => {
    res.render("servicos", { user: req.session.user });
});

router.get("/servicos/novo", verificarAutenticacao, (req, res) => {
    res.render("servico-novo", { user: req.session.user });
});

router.get("/ordem-servico", verificarAutenticacao, (req, res) => {
    res.render("ordem-servico", { user: req.session.user });
});

router.get("/ordem-servico/novo", verificarAutenticacao, (req, res) => {
    res.render("ordem-servico-novo", { user: req.session.user });
});

router.get("/scrum-board", verificarAutenticacao, (req, res) => {
    res.render("scrum-board", { user: req.session.user });
});

router.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/login"));
});

module.exports = router;