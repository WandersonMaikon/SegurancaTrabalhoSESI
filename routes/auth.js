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
    res.render("dashboard", {
        user: req.session.user,
        currentPage: 'dashboard'
    });
});

router.get("/clientes", verificarAutenticacao, (req, res) => {
    res.render("clientes", {
        user: req.session.user,
        currentPage: 'clientes'
    });
});

router.get("/clientes/novo", verificarAutenticacao, (req, res) => {
    res.render("cliente-novo", {
        user: req.session.user,
        currentPage: 'clientes'
    });
});

router.get("/servicos", verificarAutenticacao, (req, res) => {
    res.render("servicos", {
        user: req.session.user,
        currentPage: 'servicos'
    });
});

router.get("/servicos/novo", verificarAutenticacao, (req, res) => {
    res.render("servico-novo", {
        user: req.session.user,
        currentPage: 'servicos'
    });
});

router.get("/ordem-servico", verificarAutenticacao, (req, res) => {
    res.render("ordem-servico", {
        user: req.session.user,
        currentPage: 'ordemservicos'
    });
});

router.get("/ordem-servico/novo", verificarAutenticacao, (req, res) => {
    res.render("ordem-servico-novo", {
        user: req.session.user,
        currentPage: 'ordem-servicos-novo'
    });
});

router.get("/relatorio", verificarAutenticacao, (req, res) => {
    res.render("relatorio", {
        user: req.session.user,
        currentPage: 'relatorio'
    });
});

router.get("/scrum-board", verificarAutenticacao, (req, res) => {
    res.render("scrum-board", {
        user: req.session.user,
        currentPage: 'scrum-board'
    });
});
router.get("/usuario", verificarAutenticacao, (req, res) => {
    res.render("usuario", {
        user: req.session.user,
        currentPage: 'usuario'
    });
});

router.get("/perfil", verificarAutenticacao, (req, res) => {
    res.render("perfil", {
        user: req.session.user,
        currentPage: 'perfil'
    });
});

router.get("/perfil/novo", verificarAutenticacao, (req, res) => {
    res.render("perfil-novo", {
        user: req.session.user,
        currentPage: 'perfil-novo'
    });
});

router.get("/usuario/novo", verificarAutenticacao, (req, res) => {
    res.render("usuario-novo", {
        user: req.session.user,
        currentPage: 'usuario-novo'
    });
});

router.get("/risco", verificarAutenticacao, (req, res) => {
    res.render("risco", {
        user: req.session.user,
        currentPage: 'risco'
    });
});

router.get("/risco/novo", verificarAutenticacao, (req, res) => {
    res.render("risco-novo", {
        user: req.session.user,
        currentPage: 'risco-novo'
    });
});

router.get("/epc", verificarAutenticacao, (req, res) => {
    res.render("epc", {
        user: req.session.user,
        currentPage: 'epc'
    });
});

router.get("/epc/novo", verificarAutenticacao, (req, res) => {
    res.render("epc-novo", {
        user: req.session.user,
        currentPage: 'epc-novo'
    });
});

router.get("/epi", verificarAutenticacao, (req, res) => {
    res.render("epis", {
        user: req.session.user,
        currentPage: 'epis'
    });
});

router.get("/epi/novo", verificarAutenticacao, (req, res) => {
    res.render("epis-novo", {
        user: req.session.user,
        currentPage: 'epis-novo'
    });
});


router.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/login"));
});

module.exports = router;