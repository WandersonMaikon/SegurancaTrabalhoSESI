const express = require("express");
const router = express.Router();
const verificarAutenticacao = require("../middlewares/auth.middleware");

router.get("/", verificarAutenticacao, (req, res) => {
    res.render("dashboard/index", {
        user: req.session.user,
        currentPage: 'dashboard'
    });
});

module.exports = router;